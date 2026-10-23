// Demo controls (only when DEMO_MODE=true): move the clock, simulate company replies, simulate a leak.
// Nothing here talks to real companies. Replies go through the same inbound pipeline a real
// email provider webhook would use (processEmail), so AI reads them exactly like real replies.
import { db } from '../db.js';
import { bad } from '../http.js';
import { advanceDays, offsetDays, now, daysBetween, nowIso } from './clock.js';
import { escalate, isResolved, fromSampleOnly, applyReplyCheck } from './requests.js';
import { processEmail, checkReply } from './inbound.js';
import { companyByKey, ensureAddress, upsertHolding } from './companies.js';
import { runBatch } from './ledger.js';

export async function advance(user, days) {
  const n = Math.max(1, Math.min(60, Number(days) || 1));
  advanceDays(user, n);
  await escalate({ userId: user.id });
  return { offsetDays: offsetDays() };
}

const refFor = (prefix) => `${prefix}-${String(now().getFullYear()).slice(2)}${Math.floor(10000 + Math.random() * 89999)}`;

/** How each pretend company answers. `after` = days after the request reached it. */
const SCRIPTS = {
  zomato: {
    after: 1,
    reply: (t, req) => {
      const ref = refFor('ZMT-DEL');
      return {
        from: 'Zomato Privacy <privacy@zomato.com>',
        subject: `Re: ${req.number} – your data deletion request is complete (Ref ${ref})`,
        text: `Hello,

Thank you for your request under the Digital Personal Data Protection Act 2023. We have deleted your Zomato account and the personal data linked to ${t.identifier}.

Deleted:
- Account profile (name, email, phone)
- Saved delivery addresses
- Order history and food preferences

We have kept:
- Tax invoices – Section 36 of the CGST Act 2017 requires us to keep them for 6 years

While you used Zomato, your data was shared with these third parties:
- Razorpay (razorpay.com): email, phone and payment details – payment processing
- AdNexa (adnexa.example): email and city – advertising and marketing

Please contact them directly to have your data deleted there as well.

Reference: ${ref}
Grievance Officer, Zomato Ltd`
      };
    }
  },
  razorpay: {
    after: 2,
    reply: (t, req) => {
      const ref = refFor('RZP-PRV');
      return {
        from: 'Razorpay Data Protection <privacy@razorpay.com>',
        subject: `Re: ${req.number} – deletion of your personal data (Ticket ${ref})`,
        text: `Hi,

We received your request. We have erased the contact details linked to ${t.identifier} from our systems.

Deleted:
- Email address and phone number
- Saved card tokens

We have kept:
- Payment transaction records – the Prevention of Money Laundering Act 2002 requires us to keep them for 5 years

Ticket: ${ref}
Razorpay Data Protection Office`
      };
    }
  },
  makemytrip: {
    after: 8, needsReminder: true,
    reply: (t, req) => {
      const ref = refFor('MMT-GR');
      return {
        from: 'MakeMyTrip Grievance Cell <grievance@makemytrip.com>',
        subject: `Re: ${req.number} – account deleted (Case ${ref})`,
        text: `Dear customer,\n\nFurther to your request and reminder, your MakeMyTrip account and the personal data linked to ${t.identifier} have been permanently deleted.\n\nCase: ${ref}\nMakeMyTrip Grievance Cell`
      };
    }
  },
  adnexa: null // never replies, so the escalation and leak story can be shown
};

function genericReply(t, req, company) {
  const ref = refFor(company.name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'REF');
  return {
    from: `${company.name} Privacy <privacy@${company.domains[0]}>`,
    subject: `Re: ${req.number} – your deletion request (Ref ${ref})`,
    text: `Hello,\n\nAs requested, your ${company.name} account and the personal data linked to ${t.identifier} have been deleted.\n\nReference: ${ref}\n${company.name} Privacy Team`
  };
}

/** Called after every clock move / escalation pass in demo mode. `force` makes due companies answer now. */
export async function demoReplies({ userId, force = false } = {}) {
  const out = [];
  // Only demo accounts ever get pretend replies
  const user = db.get('users', userId);
  if (!user) return out;
  for (const t of db.filter('targets', x => x.userId === userId && !x.demoReplied && !isResolved(x) && ['sent', 'no-response', 'awaiting-reply', 'overdue'].includes(x.status) && x.sentAt)) {
    // Real accounts only get pretend replies for companies that came from the sample inbox
    if (!user.demo && !fromSampleOnly(user, db.get('companies', t.companyId))) continue;
    const company = db.get('companies', t.companyId);
    const req = db.get('requests', t.requestId);
    if (!company?.domains?.length || !req || req.status !== 'active') continue;
    const script = company.key in SCRIPTS ? SCRIPTS[company.key] : { after: 5, reply: (tt, rr) => genericReply(tt, rr, company) };
    if (!script || company.fictional && !(company.key in SCRIPTS)) continue;
    const age = daysBetween(t.sentAt, now());
    if (script.needsReminder && !t.reminderAt) continue;
    if (!force && age < script.after) continue;
    if (t.status === 'overdue' && !force) continue;
    const addr = t.addressId ? db.get('addresses', t.addressId) : null;
    if (addr && addr.status !== 'active') continue;
    db.update('targets', t.id, { demoReplied: true });
    const m = script.reply(t, req);
    if (addr) {
      const r = await processEmail({ to: addr.email, from: m.from, subject: m.subject, text: m.text, dkim: 'pass' });
      out.push({ company: company.name, action: r.action });
    } else {
      // No protected inbox: the reply is read by AI directly, as if it had arrived
      const check = await checkReply(user, company, { from: m.from, subject: m.subject, text: m.text, dkim: 'pass' });
      await applyReplyCheck(db.get('targets', t.id), check, null);
      out.push({ company: company.name, action: 'reply-checked' });
    }
  }
  return out;
}

/** Companies with an open request answer now (AdNexa never does). */
export async function repliesNow(user) {
  const first = await demoReplies({ userId: user.id, force: true });
  // a reply can name new partners, who get a request too; let the scripted ones answer as well
  const second = await demoReplies({ userId: user.id, force: true });
  return [...first, ...second];
}

/** Prepare the story: Zomato and MakeMyTrip know you by protected addresses. */
export function setupStory(user) {
  const made = [];
  for (const key of ['zomato', 'makemytrip']) {
    const c = companyByKey(key);
    upsertHolding(user.id, c, { sources: ['manual'], usingProtected: true, lastSeen: nowIso() });
    made.push({ company: c.name, companyId: c.id, address: ensureAddress(user.id, c).email });
  }
  return { companies: made };
}

/** The pretend ad network passes the user's Zomato address to PizzaPoint, who emails it. */
export async function simulateLeak(user) {
  const zomato = companyByKey('zomato');
  const addr = db.find('addresses', a => a.userId === user.id && a.companyId === zomato.id && a.status === 'active');
  if (!addr) throw bad('First give Zomato a protected email (Protect a sign-up, or "Set up demo story" in Demo controls), so there is something to leak.');
  return processEmail({ to: addr.email, from: 'PizzaPoint Offers <offers@pizzapoint.example>', subject: `Flat 50% off your first order, ${user.name.split(' ')[0]}!`, text: 'Hungry? PizzaPoint is now in your area. Use code FIRST50 on your first order. Unsubscribe anytime.', dkim: 'pass' });
}

export async function anchorNow() { return runBatch(); }

/** Demo accounts last 3 days, then they and everything they made are removed.
 *  Receipts stay, because they are part of anchored ledger batches. */
const KEEP = new Set(['users', 'companies', 'staff', 'i18n', 'meta', 'policies', 'receipts', 'batches', 'aiLog']);
export function cleanupDemoAccounts(maxAgeDays = 3) {
  const cutoff = Date.now() - maxAgeDays * 86400000;
  const old = db.filter('users', u => u.demo && new Date(u.createdAt).getTime() < cutoff);
  if (!old.length) return 0;
  const ids = new Set(old.map(u => u.id));
  for (const c of ['otps', 'passkeys', 'challenges', 'addresses', 'holdings', 'scans', 'requests', 'targets', 'messages', 'alerts', 'evidence', 'complaints', 'certificates', 'chats', 'outbox', 'leaks', 'chatsIndex']) {
    if (!KEEP.has(c)) db.remove(c, r => ids.has(r.userId));
  }
  db.remove('users', u => ids.has(u.id));
  return ids.size;
}
