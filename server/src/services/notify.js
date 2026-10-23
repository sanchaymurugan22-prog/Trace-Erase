// Outgoing email/SMS, alerts and the activity log.
// Without SMTP/Twilio settings, messages go to the Dev outbox (visible in the app) instead.
import { config, devMailOnly } from '../config.js';
import { db } from '../db.js';
import { nowIso } from './clock.js';

let transporter = null;
async function getTransport() {
  if (!config.smtp.host) return null;
  if (transporter) return transporter;
  try {
    const nodemailer = (await import('nodemailer')).default;
    transporter = nodemailer.createTransport({
      host: config.smtp.host, port: config.smtp.port, secure: config.smtp.port === 465,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined
    });
    return transporter;
  } catch (e) {
    console.warn('[mail] nodemailer not available, using Dev outbox only:', e.message);
    return null;
  }
}

const parseAddr = (v) => {
  const m = String(v || '').match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  return m ? { name: m[1].trim() || undefined, email: m[2].trim() } : { email: String(v || '').trim() };
};

async function viaBrevo({ from, to, replyTo, cc, subject, text, html }) {
  const sender = parseAddr(from);
  const body = { sender: { email: sender.email, ...(sender.name ? { name: sender.name } : {}) }, to: [parseAddr(to)], subject, textContent: text, ...(html ? { htmlContent: html } : {}) };
  if (replyTo) body.replyTo = parseAddr(replyTo);
  if (cc) body.cc = [parseAddr(cc)];
  const r = await fetch(`${config.brevo.baseUrl.replace(/\/$/, '')}/v3/smtp/email`, {
    method: 'POST', headers: { 'api-key': config.brevo.apiKey, 'Content-Type': 'application/json', accept: 'application/json' }, body: JSON.stringify(body)
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.message || `Brevo error ${r.status}`);
  return j.messageId;
}

/** The address TraceErase sends its own emails from (codes, forwarded mail, alerts). */
export const systemFrom = () => config.brevo.from || config.smtp.from;

/**
 * Send an email. It is always recorded in the outbox. It is delivered for real when Brevo or SMTP is set,
 * `deliver` is true, and the account is not a demo account (demo accounts never send real email).
 */
export async function sendEmail({ userId = null, to, from, replyTo, cc, subject, text, html, kind = 'email', meta = {}, deliver = true, holdNote }) {
  const user = userId ? db.get('users', userId) : null;
  const demo = !!user?.demo;
  const willSend = deliver && !demo && !devMailOnly;
  const rec = db.insert('outbox', {
    userId, channel: 'email', to, from: from || systemFrom(), replyTo: replyTo || null, subject, text, kind, meta,
    sentAt: nowIso(), delivered: false,
    deliveryNote: demo ? 'Demo account: shown here only, never sent' : !deliver ? (holdNote || 'Held for your review') : devMailOnly ? 'Shown in Dev outbox (no email service configured)' : 'Sending…'
  });
  if (!willSend) return rec;
  try {
    if (config.brevo.apiKey) {
      const id = await viaBrevo({ from: from || systemFrom(), to, replyTo, cc, subject, text, html });
      db.update('outbox', rec.id, { delivered: true, deliveryNote: 'Sent by Brevo', providerId: id || null });
    } else {
      const t = await getTransport();
      if (!t) { db.update('outbox', rec.id, { deliveryNote: 'Email service not available' }); return rec; }
      await t.sendMail({ from: from || systemFrom(), to, replyTo, cc, subject, text, html });
      db.update('outbox', rec.id, { delivered: true, deliveryNote: 'Sent by SMTP' });
    }
  } catch (e) {
    console.warn('[mail] sending failed:', e.message);
    db.update('outbox', rec.id, { delivered: false, deliveryNote: 'Not sent: ' + e.message });
  }
  return db.get('outbox', rec.id);
}

export async function sendSms({ userId = null, to, text, kind = 'sms' }) {
  const rec = db.insert('outbox', {
    userId, channel: 'sms', to, text, kind, sentAt: nowIso(), delivered: false,
    deliveryNote: 'Shown in Dev outbox (no SMS provider configured)'
  });
  const { sid, token, from } = config.twilio;
  if (sid && token && from) {
    try {
      const body = new URLSearchParams({ To: to.replace(/\s/g, ''), From: from, Body: text });
      const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'POST',
        headers: { Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
        body
      });
      db.update('outbox', rec.id, r.ok ? { delivered: true, deliveryNote: 'Sent by Twilio' } : { deliveryNote: 'Twilio error ' + r.status });
    } catch (e) { db.update('outbox', rec.id, { deliveryNote: 'Twilio error: ' + e.message }); }
  }
  return rec;
}

/** Alerts shown in the Alerts page and dashboard. */
export function createAlert(userId, { type, severity = 'info', title, body, link = null, refId = null, needsAction = false }) {
  // Alerts that are not already covered by a request event go to the activity log too
  if (!['request', 'reply'].includes(type)) db.insert('activity', { userId, at: nowIso(), kind: type === 'leak' ? 'leak' : type === 'scan' ? 'scan' : 'alert', title, detail: body || '', link, actor: 'TraceErase' });
  return db.insert('alerts', { userId, type, severity, title, body, link, refId, needsAction, read: false, at: nowIso() });
}

/** Activity log entry: something reached a protected address or number. */
export function logMessage(userId, rec) {
  return db.insert('messages', { userId, at: nowIso(), ...rec });
}
