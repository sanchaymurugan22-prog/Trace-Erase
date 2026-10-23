// Sign-up confirmation and password-reset emails in TraceErase's own design.
// Firebase makes the secure link (with the server's service account); Brevo delivers our branded email.
// If either is not set up, the website falls back to Firebase's standard email.
import { config, devMailOnly } from '../config.js';
import { accessToken, projectId, serviceAccount } from '../util/google.js';
import { verifyIdToken } from '../util/firebaseToken.js';
import { sendEmail, systemFrom } from './notify.js';
import { brandedEmail, plainText } from './emailTemplate.js';
import { bad } from '../http.js';

const base = () => (process.env.IDENTITY_BASE_URL || 'https://identitytoolkit.googleapis.com/v1').replace(/\/$/, '');
export const brandedAuthEmails = () => !!(serviceAccount() && config.brevo.apiKey && !devMailOnly);

async function oobLink(body) {
  const token = await accessToken('https://www.googleapis.com/auth/cloud-platform');
  const r = await fetch(`${base()}/projects/${projectId()}/accounts:sendOobCode`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, returnOobLink: true })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.oobLink) throw new Error(j.error?.message || 'Could not create the link');
  return j.oobLink;
}

const from = () => { const f = systemFrom(); return /</.test(f) ? f.replace(/^[^<]*</, 'TraceErase <') : `TraceErase <${f}>`; };
const site = () => config.appUrl.replace(/\/$/, '');

export async function sendVerification({ idToken }) {
  if (!brandedAuthEmails()) throw bad('fallback');
  let c;
  try { c = await verifyIdToken(idToken); } catch (e) { throw bad(e.message); }
  if (c.email_verified) return { sent: false, alreadyVerified: true };
  const link = await oobLink({ requestType: 'VERIFY_EMAIL', email: c.email, continueUrl: `${site()}/signup/check-email?confirmed=1` });
  const first = String(c.name || '').split(' ')[0];
  const o = {
    preheader: 'One click to confirm your email and start removing your data from companies.',
    title: `Welcome${first ? `, ${first}` : ''}! Confirm your email`,
    intro: 'You are one click away from taking back your personal data. Confirm this is your email address to finish creating your TraceErase account.',
    button: { label: 'Confirm my email', url: link },
    points: ['Find every company that has your data', 'Send legal deletion requests written by AI', 'Get sealed proof of every reply and deletion'],
    note: 'This link works once and expires soon. If you did not create a TraceErase account, you can safely ignore this email.'
  };
  const out = await sendEmail({ to: c.email, from: from(), subject: 'Confirm your email for TraceErase', text: plainText(o), html: brandedEmail(o), kind: 'verify-email' });
  if (!out.delivered) throw bad('fallback');
  return { sent: true };
}

export async function sendPasswordReset({ email }) {
  if (!brandedAuthEmails()) throw bad('fallback');
  const e = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw bad('Please enter a valid email address.');
  let link;
  try { link = await oobLink({ requestType: 'PASSWORD_RESET', email: e, continueUrl: `${site()}/login` }); }
  catch { return { sent: true }; } // never reveal whether an account exists
  const o = {
    preheader: 'Reset your TraceErase password.',
    title: 'Reset your password',
    intro: 'Someone (hopefully you) asked to reset the password for your TraceErase account. Choose a new one with the button below.',
    button: { label: 'Choose a new password', url: link },
    note: 'If you did not ask for this, ignore this email. Your password stays the same.'
  };
  await sendEmail({ to: e, from: from(), subject: 'Reset your TraceErase password', text: plainText(o), html: brandedEmail(o), kind: 'password-reset' });
  return { sent: true };
}
