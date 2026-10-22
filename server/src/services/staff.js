// Staff accounts: regulators (Data Protection Board officers) who sign in with email + password.
// Built-in accounts come from REGULATOR_ACCOUNTS in server/.env and are created on startup.
import crypto from 'node:crypto';
import { config } from '../config.js';
import { db } from '../db.js';
import { bad, unauthorized, forbidden } from '../http.js';
import { sign, verify } from '../util/token.js';

const COOKIE = 'te_staff';

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 32).toString('hex');
  return `${salt}:${hash}`;
}
function checkPassword(password, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(String(password), salt, 32);
  const want = Buffer.from(hash, 'hex');
  return want.length === test.length && crypto.timingSafeEqual(want, test);
}

/** Create (or update the password of) the regulator accounts listed in the config. */
export function seedStaff() {
  for (const { email, password } of config.regulators) {
    if (!email || !password) continue;
    const existing = db.find('staff', s => s.email === email);
    const name = email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    if (!existing) db.insert('staff', { email, name, role: 'regulator', org: 'Data Protection Board (demo)', passwordHash: hashPassword(password) });
    else if (!checkPassword(password, existing.passwordHash)) db.update('staff', existing.id, { passwordHash: hashPassword(password) });
  }
}

export const publicStaff = (s) => s && ({ id: s.id, email: s.email, name: s.name, role: s.role, org: s.org });

const attempts = new Map();
export function login(res, { email, password }) {
  const e = String(email || '').trim().toLowerCase();
  const n = attempts.get(e) || 0;
  if (n >= 8) throw bad('Too many attempts. Try again in a few minutes.');
  const s = db.find('staff', x => x.email === e);
  if (!s || !checkPassword(password, s.passwordHash)) {
    attempts.set(e, n + 1);
    setTimeout(() => attempts.delete(e), 5 * 60 * 1000);
    throw bad('Email or password is not correct');
  }
  attempts.delete(e);
  db.update('staff', s.id, { lastLogin: new Date().toISOString() });
  const token = sign({ sid: s.id, t: 'staff' }, 60 * 60 * 12);
  res.cookie(COOKIE, token, { maxAge: 60 * 60 * 12, ...crossSite() });
  return { staff: publicStaff(s), token };
}
// When the website and the API are on different domains, cookies must be SameSite=None; Secure
const crossSite = () => (process.env.CROSS_SITE_COOKIES === 'true' ? { sameSite: 'None', secure: true } : {});
export function logout(res) { res.cookie(COOKIE, '', { maxAge: 0 }); }

export function currentStaff(req) {
  // Cookie (same site) or the X-Staff-Token header (website and API on different domains)
  const p = verify(req.cookies[COOKIE]) || verify(String(req.headers['x-staff-token'] || ''));
  if (!p || p.t !== 'staff') return null;
  return db.get('staff', p.sid);
}
export function requireRegulator(req) {
  const s = currentStaff(req);
  if (!s) throw unauthorized('Please log in as a regulator');
  if (s.role !== 'regulator') throw forbidden('Regulators only');
  req.staff = s;
}
