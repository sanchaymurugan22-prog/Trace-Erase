// Accounts, one-time codes and sessions.
import { config, devMailOnly } from '../config.js';
import { db } from '../db.js';
import { bad, unauthorized } from '../http.js';
import { randomCode } from '../util/crypto.js';
import { sign, verify, hashSecret } from '../util/token.js';
import { sendEmail, sendSms } from './notify.js';
import { verifyIdToken } from '../util/firebaseToken.js';
import { nowIso, useClockOf } from './clock.js';

export const DEFAULT_SETTINGS = {
  autoOtp: true, autoEscalate: true, autoFile: false, strictMode: true,
  theme: 'light', textSize: 'default',
  alerts: { leaks: true, replies: true, deadlines: true, newCompanies: false },
  alertChannels: { browser: true, email: true, sms: false }
};

const normEmail = (e) => String(e || '').trim().toLowerCase();
export function normPhone(p) {
  const d = String(p || '').replace(/[^\d+]/g, '');
  if (!d) return '';
  if (d.startsWith('+')) return d;
  if (d.length === 10) return '+91' + d;
  return '+' + d;
}
const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

/** Verified = email confirmed. Phone numbers are confirmed by SMS only in the code-based sign-up (local use);
 *  Firebase accounts and demo accounts don't need it (SMS isn't available on the free plan). */
/** Protected phone numbers need a paid phone service, so real accounts only get one when Twilio is set. */
export const shownNumber = (u) => (u?.demo || config.twilio.sid ? u?.protectedNumber || null : null);

export const isVerified = (u) => !!(u?.verifiedEmail && (u.verifiedPhone || u.firebaseUid || u.demo));

export const publicUser = (u) => u && ({
  id: u.id, name: u.name, email: u.email, phone: u.phone, language: u.language || 'en', letterLanguage: u.letterLanguage || 'en',
  protectedNumber: shownNumber(u), verified: isVerified(u),
  verifiedEmail: !!u.verifiedEmail, verifiedPhone: !!u.verifiedPhone, demo: !!u.demo,
  authProvider: u.authProvider || (u.firebaseUid ? 'password' : 'code'),
  hasPasskey: db.filter('passkeys', p => p.userId === u.id).length > 0,
  onboarding: u.onboarding || {}, settings: { ...DEFAULT_SETTINGS, ...(u.settings || {}) },
  gmailConnected: !!u.gmail?.refreshToken, createdAt: u.createdAt
});

function issueCode(user, channel, purpose) {
  db.remove('otps', o => o.userId === user.id && o.channel === channel && o.purpose === purpose);
  const code = randomCode(6);
  db.insert('otps', { userId: user.id, channel, purpose, codeHash: hashSecret(code), attempts: 0, expiresAt: new Date(Date.now() + 10 * 60000).toISOString() });
  return code;
}

async function deliverCodes(user, purpose, channels) {
  const dev = {};
  for (const ch of channels) {
    const code = issueCode(user, ch, purpose);
    if (ch === 'email') {
      await sendEmail({ userId: user.id, to: user.email, subject: `${code} is your TraceErase code`, text: `Your TraceErase verification code is ${code}. It expires in 10 minutes.`, kind: 'otp' });
      if (devMailOnly) dev.email = code;
    } else {
      await sendSms({ userId: user.id, to: user.phone, text: `${code} is your TraceErase code. It expires in 10 minutes.`, kind: 'otp' });
      if (!config.twilio.sid) dev.phone = code;
    }
  }
  return dev;
}

export async function signup({ name, email, phone, language }) {
  email = normEmail(email); phone = normPhone(phone);
  if (!name || name.trim().length < 2) throw bad('Please enter your name');
  if (!isEmail(email)) throw bad('Please enter a valid email');
  if (phone.replace(/\D/g, '').length < 10) throw bad('Please enter a valid mobile number');
  let user = db.find('users', u => u.email === email);
  if (user && user.verifiedEmail && user.verifiedPhone) throw bad('An account with this email already exists. Please log in.');
  if (db.find('users', u => u.phone === phone && u.email !== email && u.verifiedPhone)) throw bad('This mobile number is already used by another account');
  if (!user) user = db.insert('users', { name: name.trim(), email, phone, language: language || 'en', settings: { ...DEFAULT_SETTINGS }, onboarding: {} });
  else db.update('users', user.id, { name: name.trim(), phone, language: language || user.language });
  const devCodes = await deliverCodes(user, 'signup', ['email', 'phone']);
  return { userId: user.id, maskedEmail: maskEmail(email), maskedPhone: maskPhone(phone), devCodes };
}

export async function requestLoginCode({ identifier }) {
  const id = String(identifier || '').trim();
  const user = isEmail(id) ? db.find('users', u => u.email === normEmail(id)) : db.find('users', u => u.phone === normPhone(id));
  if (!user) throw bad('No account found. Please sign up first.');
  const channel = isEmail(id) ? 'email' : 'phone';
  const devCodes = await deliverCodes(user, 'login', [channel]);
  return { userId: user.id, channel, masked: channel === 'email' ? maskEmail(user.email) : maskPhone(user.phone), devCodes };
}

function checkCode(userId, channel, purpose, code) {
  const o = db.find('otps', x => x.userId === userId && x.channel === channel && x.purpose === purpose);
  if (!o) throw bad(`Please request a new ${channel === 'email' ? 'email' : 'SMS'} code`);
  if (new Date(o.expiresAt) < new Date()) throw bad('That code has expired. Please request a new one.');
  if (o.attempts >= 5) throw bad('Too many attempts. Please request a new code.');
  if (hashSecret(String(code || '').trim()) !== o.codeHash) {
    db.update('otps', o.id, { attempts: o.attempts + 1 });
    throw bad(`The ${channel === 'email' ? 'email' : 'SMS'} code is not correct`);
  }
  db.remove('otps', x => x.id === o.id);
}

export function verifySignup({ userId, emailCode, phoneCode }) {
  const user = db.get('users', userId);
  if (!user) throw bad('Account not found');
  if (!user.verifiedEmail) { checkCode(userId, 'email', 'signup', emailCode); db.update('users', userId, { verifiedEmail: nowIso() }); }
  if (!user.verifiedPhone) { checkCode(userId, 'phone', 'signup', phoneCode); db.update('users', userId, { verifiedPhone: nowIso() }); }
  if (!user.protectedNumber) db.update('users', userId, { protectedNumber: newProtectedNumber() });
  return db.get('users', userId);
}

export function verifyLogin({ userId, channel, code }) {
  const user = db.get('users', userId);
  if (!user) throw bad('Account not found');
  checkCode(userId, channel, 'login', code);
  return user;
}

export async function resendCodes({ userId, purpose = 'signup' }) {
  const user = db.get('users', userId);
  if (!user) throw bad('Account not found');
  const channels = purpose === 'signup' ? ['email', 'phone'].filter(c => !(c === 'email' ? user.verifiedEmail : user.verifiedPhone)) : ['email'];
  return { devCodes: await deliverCodes(user, purpose, channels) };
}

function newProtectedNumber() {
  for (let i = 0; i < 50; i++) {
    const n = `${config.protectedNumberPrefix} ${String(Math.floor(10000 + Math.random() * 89999))}`;
    if (!db.find('users', u => u.protectedNumber === n)) return n;
  }
  return `${config.protectedNumberPrefix} ${Date.now() % 100000}`;
}

const crossSite = () => (process.env.CROSS_SITE_COOKIES === 'true' ? { sameSite: 'None', secure: true } : {});
export function startSession(res, user) {
  const token = sign({ uid: user.id, t: 'user' }, user.demo ? 60 * 60 * 24 * 3 : 60 * 60 * 24 * 14);
  res.cookie('te_session', token, { maxAge: user.demo ? 60 * 60 * 24 * 3 : 60 * 60 * 24 * 14, ...crossSite() });
  return token;
}
export function endSession(res) { res.cookie('te_session', '', { maxAge: 0, ...crossSite() }); }

/** Sign in or sign up with a Firebase ID token (email + password, or Google). */
export async function firebaseLogin({ idToken, name, phone, language } = {}) {
  let c;
  try { c = await verifyIdToken(idToken); }
  catch (e) { throw bad(e.message); }
  const email = normEmail(c.email);
  if (!email) throw bad('Your sign-in has no email address. Please use email or Google.');
  const provider = c.firebase?.sign_in_provider || 'password';
  let user = db.find('users', u => u.firebaseUid === c.sub);
  if (!user) {
    // An older account with the same email is linked only when Google/Firebase confirms the email
    const same = db.find('users', u => u.email === email && !u.demo);
    if (same && same.firebaseUid && same.firebaseUid !== c.sub) throw bad('This email is already linked to another sign-in. Please use that one.');
    if (same && !c.email_verified) throw bad('An account with this email exists. Please confirm your email first, then sign in again.');
    if (same) user = db.update('users', same.id, { firebaseUid: c.sub, authProvider: provider });
  }
  const ph = normPhone(phone);
  if (!user) {
    const display = String(name || c.name || email.split('@')[0]).trim().slice(0, 80);
    user = db.insert('users', {
      firebaseUid: c.sub, authProvider: provider, name: display, email, phone: ph.replace(/\D/g, '').length >= 10 ? ph : '',
      language: language || 'en', settings: { ...DEFAULT_SETTINGS }, onboarding: {},
      verifiedEmail: c.email_verified ? nowIso() : null, protectedNumber: newProtectedNumber()
    });
  } else {
    const patch = {};
    if (c.email_verified && !user.verifiedEmail) patch.verifiedEmail = nowIso();
    if (!user.protectedNumber) patch.protectedNumber = newProtectedNumber();
    if (Object.keys(patch).length) user = db.update('users', user.id, patch);
  }
  return user;
}

/** A demo account: sample data, demo controls and its own demo clock. Removed after 3 days. */
export function createDemoUser({ name, language } = {}) {
  const tag = Math.random().toString(36).slice(2, 8);
  return db.insert('users', {
    demo: true, name: String(name || 'Demo User').slice(0, 60), email: `demo-${tag}@demo.traceerase.app`, phone: '+919876543210',
    language: language || 'en', settings: { ...DEFAULT_SETTINGS }, onboarding: {}, clockOffsetMs: 0,
    verifiedEmail: nowIso(), verifiedPhone: nowIso(), protectedNumber: newProtectedNumber(), authProvider: 'demo'
  });
}

export function currentUser(req) {
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const p = verify(req.cookies.te_session) || verify(bearer);
  if (!p || p.t !== 'user') return null;
  const u = db.get('users', p.uid);
  if (u) useClockOf(u);
  return u;
}

export function requireUser(req) {
  const u = currentUser(req);
  if (!u) throw unauthorized();
  req.user = u;
}
export function requireVerified(req) {
  requireUser(req);
  if (!isVerified(req.user)) throw unauthorized(req.user.firebaseUid ? 'Please confirm your email first' : 'Please verify your email and phone first');
}

export function maskEmail(e) { const [a, d] = e.split('@'); return `${a[0]}${'•'.repeat(Math.max(2, a.length - 2))}${a.at(-1)}@${d}`; }
export function maskPhone(p) { const d = p.replace(/\D/g, ''); return `${p.startsWith('+91') ? '+91 ' : '+'}${'•'.repeat(6)} ${d.slice(-4)}`; }
