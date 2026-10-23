// The account activity log: everything the person did and everything TraceErase did for them.
// Stored per user in the "activity" collection; shown on the Activity log page.
import { db } from '../db.js';
import { nowIso } from './clock.js';

/** kind: account | settings | scan | request | letter | reply | escalation | protect | leak | evidence | ai | alert */
export function logActivity(userId, { kind, title, detail = '', link = null, actor = 'you' }) {
  if (!userId || !title) return null;
  return db.insert('activity', { userId, at: nowIso(), kind, title: String(title).slice(0, 200), detail: String(detail || '').slice(0, 400), link, actor });
}

const plural = (n, w) => `${n} ${n === 1 ? w : w.endsWith('y') ? w.slice(0, -1) + 'ies' : w + 's'}`;
const SETTING_NAMES = { autoOtp: 'automatic verification codes', autoEscalate: 'automatic escalation', autoFile: 'automatic complaint filing', theme: 'appearance', textSize: 'text size', alerts: 'alert preferences', channels: 'alert channels', lowData: 'low-data mode' };

/** What a successful request means, in words. Returns null for requests not worth logging. */
export function describeAction(req, out) {
  const b = req.body || {}, p = req.routePattern, m = req.method;
  if (m === 'GET') return null;
  const R = {
    'POST /api/auth/firebase': () => ({ kind: 'account', title: 'Signed in', detail: out?.user?.authProvider === 'google.com' ? 'With Google' : 'With email and password' }),
    'POST /api/auth/verify': () => ({ kind: 'account', title: 'Account created and verified' }),
    'POST /api/auth/login/verify': () => ({ kind: 'account', title: 'Signed in', detail: 'With a one-time code' }),
    'POST /api/auth/passkey/login/verify': () => ({ kind: 'account', title: 'Signed in', detail: 'With your passkey' }),
    'POST /api/auth/passkey/register/verify': () => ({ kind: 'account', title: 'Passkey added', detail: b.label || '' }),
    'POST /api/auth/logout': () => ({ kind: 'account', title: 'Signed out' }),
    'POST /api/demo/start': () => ({ kind: 'account', title: 'Demo account started' }),
    'PATCH /api/me': () => {
      const parts = [];
      if (b.name) parts.push('name');
      if (b.language) parts.push('app language');
      if (b.letterLanguage) parts.push('letter language');
      if (b.phone !== undefined) parts.push('phone number');
      if (b.settings) parts.push(...Object.keys(b.settings).map(k => SETTING_NAMES[k] || k));
      if (!parts.length) return null;
      return { kind: 'settings', title: 'Settings changed', detail: 'Changed: ' + [...new Set(parts)].join(', ') };
    },
    'POST /api/scan': () => ({ kind: 'scan', title: 'Started an AI scan', detail: b.typed ? `Apps you listed (${plural((b.messages || []).length, 'app')})` : b.source === 'upload' ? `Your email export (${plural((b.messages || []).length, 'email')})` : b.source === 'gmail' ? 'Your Gmail' : 'Sample Gmail inbox (demo)' }),
    'POST /api/requests/draft': () => ({ kind: 'request', title: `Prepared deletion request ${out?.number || ''}`, detail: plural(out?.targets?.length || 0, 'company') }),
    'POST /api/requests/:id/sign': () => ({ kind: 'request', title: `Signed and sent deletion request ${out?.number || ''}`, detail: `${plural(out?.targets?.length || 0, 'company')} · ${out?.signature ? 'signed with your passkey' : 'confirmed with your account'}`, link: out?.id ? `/app/requests/${out.id}` : null }),
    'POST /api/requests/:id/certificate': () => ({ kind: 'evidence', title: 'Deletion certificate issued', link: out?.id ? `/app/certificates/${out.id}` : null }),
    'POST /api/targets/:id/send': () => ({ kind: 'letter', title: `Sent the deletion letter to ${out?.letter?.to || 'the company'}` }),
    'POST /api/targets/:id/reply': () => ({ kind: 'reply', title: 'Added a company reply for AI to check', detail: out?.replyCheck?.summary || '' }),
    'POST /api/targets/:id/webform-done': () => ({ kind: 'letter', title: 'Marked a web form as submitted', detail: b.reference ? `Ticket ${b.reference}` : '' }),
    'POST /api/identity/protect': () => ({ kind: 'protect', title: `Created a protected email for ${out?.company?.name || 'a sign-up'}`, detail: out?.address?.email || '' }),
    'POST /api/identity/addresses/:id/rotate': () => ({ kind: 'protect', title: 'Replaced a protected email with a new one', detail: out?.email || '' }),
    'POST /api/evidence': () => ({ kind: 'evidence', title: 'Built an evidence pack', link: out?.id ? `/app/evidence/${out.id}` : null }),
    'POST /api/identity/addresses/:id/allow': () => ({ kind: 'protect', title: 'Allowed a sender', detail: b.domain || '' }),
    'POST /api/identity/addresses/:id/senders/remove': () => ({ kind: 'protect', title: 'Removed a sender from a protected email', detail: b.domain || '' }),
    'POST /api/leaks/:id/actions': () => ({ kind: 'leak', title: 'Acted on a leak', detail: String(b.action || '').replace(/-/g, ' ') }),
    'POST /api/companies/:id/fix': () => ({ kind: 'protect', title: 'Updated how a company knows you', detail: String(b.action || '').replace(/-/g, ' ') }),
    'POST /api/targets/:id/mark-sent': () => ({ kind: 'letter', title: 'Marked a letter as sent' }),
    'POST /api/complaints/:id/file': () => ({ kind: 'evidence', title: 'Filed a complaint with the Data Protection Board', detail: out?.reference || '' }),
    'DELETE /api/me': () => ({ kind: 'account', title: 'Deleted the TraceErase account' }),
    'POST /api/demo/advance': () => ({ kind: 'account', title: `Demo clock moved forward ${plural(Number(b.days) || 1, 'day')}` }),
    'POST /api/demo/leak': () => ({ kind: 'leak', title: 'Demo: simulated a leak' }),
    'POST /api/demo/replies': () => ({ kind: 'reply', title: 'Demo: companies replied' }),
    'POST /api/requests/:id/sample-replies': () => ({ kind: 'reply', title: 'Sample companies replied' })
  };
  const f = R[`${m} ${p}`];
  if (f) return f();
  // Anything else that changed something is still recorded, in general words
  if (/^\/api\/(assistant|i18n|ai\/|ext\/|cron|inbound|health)/.test(p)) return null;
  return null;
}
