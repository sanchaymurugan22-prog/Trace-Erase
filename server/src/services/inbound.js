// Everything that reaches a protected email address or the protected number.
// Wire a real provider's inbound webhook (Mailgun, SendGrid, Cloudflare Email Workers, Twilio)
// to /api/inbound/email and /api/inbound/sms; the demo panel uses the same entry points.
import { db } from '../db.js';
import { notFound } from '../http.js';
import { generate, withFallback, maskFor } from '../ai/gemini.js';
import { addReceipt } from './ledger.js';
import { createAlert, logMessage, sendEmail, sendSms } from './notify.js';
import { applyReplyCheck, isResolved } from './requests.js';
import { rootDomain, domainOf, getOrCreateCompany, partnersOf } from './companies.js';
import { nowIso, now } from './clock.js';

const otpIn = (text) => (String(text).match(/\b(\d{4,8})\b(?=[^\d]*(?:is your|code|otp|verification|one[- ]time))|(?:code|otp|verification)[^\d]{0,30}(\d{4,8})/i) || []).slice(1).find(Boolean) || null;

function parseSender(from) {
  const m = String(from || '').match(/^\s*"?([^"<]*)"?\s*<([^>]+)>/);
  const email = (m ? m[2] : from || '').trim().toLowerCase();
  return { name: m ? m[1].trim() : '', email, domain: rootDomain(domainOf(email)) };
}

/** Open deletion target this message answers: the sender's company must be one we asked, using this address. */
function targetForSender(user, address, sender) {
  const open = db.filter('targets', t => t.userId === user.id && !isResolved(t) && !['queued', 'refused'].includes(t.status) && t.sentAt);
  const matches = open.filter(t => {
    const c = db.get('companies', t.companyId);
    return (c?.domains || []).some(d => sender.domain === d || sender.domain.endsWith('.' + d)) && (t.addressId === address.id || t.identifier === address.email || address.companyId === t.companyId);
  });
  return matches.at(-1) || null;
}

/**
 * @param {{to:string, from:string, subject?:string, text?:string, dkim?:'pass'|'fail'|'none'}} msg
 */
export async function processEmail(msg) {
  const to = String(msg.to || '').trim().toLowerCase();
  const address = db.find('addresses', a => a.email === to);
  if (!address) throw notFound('No protected address matches ' + to);
  const user = db.get('users', address.userId);
  const company = db.get('companies', address.companyId);
  const sender = parseSender(msg.from);
  const settings = user.settings || {};
  const target = address.status === 'active' ? targetForSender(user, address, sender) : null;
  const allowed = address.status === 'active' && (!!target || address.allowed.some(d => sender.domain === d || sender.domain.endsWith('.' + d)));
  const spoof = allowed && msg.dkim === 'fail';
  const base = { channel: 'email', from: sender.name || sender.email, fromAddress: sender.email, to: address.email, addressId: address.id, companyId: company.id, subject: msg.subject || '' };

  if (target && !spoof) {
    const tc = db.get('companies', target.companyId);
    // 1. Verification code for the user's own deletion request
    const code = otpIn(`${msg.subject} ${msg.text}`);
    if (code && settings.autoOtp !== false && !/delet|erase/i.test(msg.subject || '')) {
      db.update('targets', target.id, t => ({ events: [...(t.events || []), { at: nowIso(), type: 'otp', text: `${tc.name} asked for a verification code. Filled automatically, as you allowed.` }], status: 'awaiting-reply' }));
      logMessage(user.id, { ...base, action: 'code', why: `Code for deletion request, filled automatically` });
      return { action: 'code-filled', targetId: target.id };
    }
    // 2. A reply to an open deletion request: AI checks it
    const check = await checkReply(user, tc, msg);
    const updated = await applyReplyCheck(target, check, null);
    logMessage(user.id, { ...base, action: 'forwarded', why: `${tc.name}'s reply to your deletion request` });
    db.update('addresses', address.id, a => ({ forwarded: a.forwarded + 1 }));
    await forward(user, msg, address);
    if (check.isConfirmation) createAlert(user.id, { type: 'reply', severity: 'good', needsAction: false, title: `${tc.name} says your data is deleted`, body: `AI checked the email: ${check.verdict === 'genuine' ? 'genuine' : 'needs a look'}${check.reference ? `, reference ${check.reference}` : ''}${check.kept?.length ? `. Kept: ${check.kept.map(k => k.what || k).join(', ')}` : ''}.`, link: `/app/requests/${updated.requestId}/targets/${updated.id}` });
    return { action: 'reply-checked', check, targetId: updated.id };
  }

  // 3. Allowed sender: forward to the real inbox
  if (allowed && !spoof) {
    db.update('addresses', address.id, a => ({ forwarded: a.forwarded + 1 }));
    logMessage(user.id, { ...base, action: 'forwarded', why: 'Allowed sender' });
    await forward(user, msg, address);
    return { action: 'forwarded' };
  }

  // 4. Not allowed: block, and if the address was given only to this company, it's a leak
  db.update('addresses', address.id, a => ({ blocked: a.blocked + 1 }));
  if (spoof) {
    logMessage(user.id, { ...base, action: 'blocked', why: `Pretended to be ${sender.domain}, DKIM failed` });
    return { action: 'blocked-spoof' };
  }
  const leak = await recordLeak(user, address, company, sender, msg);
  logMessage(user.id, { ...base, action: 'blocked', why: 'Not an allowed sender · leak alert raised', leakId: leak.id });
  return { action: 'leak', leakId: leak.id };
}

async function forward(user, msg, address) {
  await sendEmail({ userId: user.id, to: user.email, replyTo: msg.from, subject: `[via ${address.email}] ${msg.subject || '(no subject)'}`, text: `${msg.text || ''}\n\n— Forwarded by TraceErase from ${msg.from}`, kind: 'forward' });
}

// Lines under a heading: "We kept:" / "Shared with:" followed by "- item" lines
function section(text, headRe) {
  const lines = String(text || '').split(/\r?\n/);
  const out = [];
  let on = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (headRe.test(line) && !/^[-•*]/.test(line)) { on = true; continue; }
    if (!on) continue;
    if (/^[-•*]\s*/.test(line)) out.push(line.replace(/^[-•*]\s*/, ''));
    else if (line) on = false;
  }
  return out;
}

function ruleCheck(company, msg) {
  const all = `${msg.subject || ''}\n${msg.text || ''}`;
  const t = all.toLowerCase();
  const isRefusal = /(cannot|unable to|will not|won't|decline to) (delete|erase|process)/.test(t);
  const isConfirmation = !isRefusal && /(has been|have been|was|were|been|we have|we've) (permanently )?(deleted|erased|removed)|account (is )?closed|deletion (is )?complete/.test(t);
  const ref = (all.match(/\b(?:ref(?:erence)?(?: number| no\.?)?|ticket|case)[^\w]{0,5}([A-Z0-9][A-Z0-9-]{4,})/i) || [])[1] || null;
  const kept = section(msg.text, /(kept|keep|retain|retained|still hold)/i).map(l => {
    const m = l.match(/^(.+?)\s*[(–—:-]\s*(.+?)\)?$/);
    return m ? { what: m[1].trim(), why: m[2].trim() } : { what: l, why: 'Not stated' };
  });
  const sharedWith = section(msg.text, /(shared|disclosed|third[- ]part|partners|processors|recipients)/i).map(l => {
    const m = l.match(/^([^(:–—]+?)\s*(?:\(([a-z0-9.-]+\.[a-z]{2,})\))?\s*(?:[:–—-]\s*(.+))?$/i);
    if (!m) return null;
    const [fpart, ppart] = (m[3] || '').split(/\s[–—-]\s/);
    const fields = ((fpart || '').match(/\b(email|phone|name|address|payment|card|orders?|location|city|device)\b/gi) || []).map(f => f.toLowerCase());
    return { name: m[1].trim(), domain: m[2] || '', fields: [...new Set(fields)], purpose: (ppart || fpart || 'Not stated').trim() };
  }).filter(Boolean);
  const deleted = section(msg.text, /(deleted|erased|removed)/i);
  return {
    isConfirmation, isRefusal, verdict: isConfirmation && ref && msg.dkim === 'pass' ? 'genuine' : 'needs-review', reference: ref,
    deleted: isConfirmation ? (deleted.length ? deleted : ['Account']) : [], kept, sharedWith,
    checks: [{ ok: !!ref, text: ref ? `Gives a reference number: ${ref}` : 'No reference number' }, { ok: isConfirmation, text: isConfirmation ? 'Says the data was deleted' : 'Does not confirm deletion' }, { ok: true, text: sharedWith.length ? `Names ${sharedWith.length} ${sharedWith.length === 1 ? 'company' : 'companies'} it shared your data with` : 'Names no partners' }],
    summary: isConfirmation ? `${company.name} says your data was deleted${kept.length ? `, but kept ${kept.map(k => k.what).join(', ')}` : ''}.` : isRefusal ? `${company.name} refused to delete.` : 'The reply does not confirm deletion yet.'
  };
}

export async function checkReply(user, company, msg) {
  const { mask } = maskFor(user);
  const res = await withFallback('reply-checker', async () => generate({
    feature: 'reply-checker',
    system: 'You check whether a company\'s email reply genuinely confirms deletion of personal data under India\'s DPDP Act. Be strict and literal. Never assume. Extract every third party the company says it shared the data with.',
    prompt: `Company: ${company.name} (${company.domains?.[0]}).
Email subject: ${mask(msg.subject)}
Email body:
${mask(msg.text).slice(0, 6000)}
DKIM result: ${msg.dkim || 'unknown'}

Return JSON:
{"isConfirmation":bool,"isRefusal":bool,"verdict":"genuine"|"needs-review"|"not-genuine",
 "reference":"reference number or null","deleted":["items it says were deleted"],"kept":[{"what":"...","why":"law or reason"}],
 "sharedWith":[{"name":"company name","domain":"domain if given, else empty","fields":["email","phone",...],"purpose":"why it was shared"}],
 "checks":[{"ok":bool,"text":"short check, e.g. Gives a reference number"}],
 "summary":"one sentence"}`,
    json: true, temperature: 0
  }), () => ruleCheck(company, msg));
  const checks = [{ ok: msg.dkim === 'pass', text: `Signed by ${company.domains?.[0]} (DKIM ${msg.dkim === 'pass' ? 'valid' : msg.dkim || 'unknown'})` }, ...(res.checks || []).filter(c => !/dkim/i.test(c.text))];
  const verdict = msg.dkim !== 'pass' && res.verdict === 'genuine' ? 'needs-review' : res.verdict;
  return { ...res, verdict, sharedWith: Array.isArray(res.sharedWith) ? res.sharedWith : [], checks, dkim: msg.dkim || 'unknown', ai: res._ai };
}

async function recordLeak(user, address, company, sender, msg) {
  const senderCompany = getOrCreateCompany({ name: sender.name || sender.domain, domain: sender.domain, category: 'Other' });
  const leakReceipt = addReceipt({
    userId: user.id, companyId: company.id, kind: 'evidence', title: `Message from ${sender.name || sender.domain} to ${company.name}-only address`,
    data: { to: address.email, from: sender.email, subject: msg.subject || '', receivedAt: nowIso() }, signedBy: 'TraceErase protected inbox'
  });
  const leak = db.insert('leaks', {
    userId: user.id, addressId: address.id, companyId: company.id, senderCompanyId: senderCompany.id,
    senderName: sender.name || sender.domain, senderEmail: sender.email, senderDomain: sender.domain,
    subject: msg.subject || '', excerpt: String(msg.text || '').slice(0, 400), at: nowIso(), receiptId: leakReceipt.id,
    actions: { blocked: true, rotated: false, deletionRequested: false }, status: 'open'
  });
  db.update('addresses', address.id, a => ({ leaks: a.leaks + 1, blockedSenders: [...new Set([...(a.blockedSenders || []), sender.domain])] }));
  const inv = await investigate(user, leak.id);
  createAlert(user.id, {
    type: 'leak', severity: 'danger', needsAction: true, refId: leak.id, link: `/app/leaks/${leak.id}`,
    title: `Leak: ${leak.senderName} emailed your ${company.name} address`,
    body: `You never gave ${leak.senderName} this address.${inv.likelySourceName ? ` AI traced it to ${inv.likelySourceName}.` : ''}`
  });
  return db.get('leaks', leak.id);
}

/** AI leak investigator: who passed the address on? */
export async function investigate(user, leakId) {
  const leak = db.get('leaks', leakId);
  const company = db.get('companies', leak.companyId);
  const partners = partnersOf(user.id, company.id).map(p => {
    const t = db.filter('targets', x => x.userId === user.id && x.companyId === p.company.id).at(-1);
    return { id: p.company.id, name: p.company.name, receivedOn: p.receipts.at(-1).issuedAt, fields: p.receipts.at(-1).data.fields, purpose: p.receipts.at(-1).data.purpose, deletionStatus: t?.status || 'not asked', daysIgnored: t?.sentAt && !['verified', 'partial', 'claimed'].includes(t.status) ? Math.floor((now() - new Date(t.sentAt)) / 86400000) : 0 };
  });
  const res = await withFallback('leak-investigator', async () => {
    const out = await generate({
      feature: 'leak-investigator',
      system: 'You are a data-leak investigator. A protected email address was given to exactly one company. Work out which company most likely passed it to the unknown sender. Reason only from the evidence given.',
      prompt: `Address given only to: ${company.name}.
Unknown sender: ${leak.senderName} (${leak.senderDomain}). Subject: "${leak.subject}".
Companies that received this address from ${company.name}, according to ${company.name}'s own written disclosure:
${JSON.stringify(partners)}

Return JSON {"likelySourceId": one of the partner ids or "${company.id}" if it was ${company.name} itself,
"confidence":"high"|"medium"|"low","reasons":["3 short evidence-based reasons"],"summary":"one sentence for the user"}`,
      json: true, temperature: 0.1
    });
    return out;
  }, () => {
    const ignored = [...partners].sort((a, b) => (b.daysIgnored || 0) - (a.daysIgnored || 0) || (a.deletionStatus === 'not asked' ? -1 : 1));
    const pick = partners.length === 1 ? partners[0] : ignored.find(p => !['verified', 'partial', 'claimed'].includes(p.deletionStatus));
    const reasons = pick ? [
      `Only ${company.name}${partners.length ? ` and the ${partners.length === 1 ? 'partner' : 'partners'} it shared with (${partners.map(p => p.name).join(', ')})` : ''} ever had this address, according to ${company.name}'s own reply.`,
      `${company.name} said in writing that it shared your data with ${pick.name}.`,
      pick.daysIgnored ? `${pick.name} ignored your deletion request for ${pick.daysIgnored} days.` : `${pick.name} has not confirmed deleting it.`
    ] : [`${company.name} named no partners, so ${company.name} itself is the likely source.`];
    return { likelySourceId: pick?.id || company.id, confidence: pick ? (partners.length === 1 ? 'high' : 'medium') : 'medium', reasons, summary: `Most likely through ${pick?.name || company.name}.` };
  });
  const src = db.get('companies', res.likelySourceId) || company;
  const chain = [{ name: 'You', note: `Gave it to ${company.name}` }, { name: company.name, companyId: company.id, note: partners.length ? 'Shared it (said so in writing)' : 'Had your address' }];
  const sp = partners.find(p => p.id === src.id);
  if (src.id !== company.id) chain.push({ name: src.name, companyId: src.id, note: sp?.daysIgnored ? `Ignored deletion for ${sp.daysIgnored} days` : 'Likely passed it on' });
  chain.push({ name: leak.senderName, leak: true, note: 'Emailed you' });
  const receipt = addReceipt({ userId: user.id, companyId: src.id, kind: 'evidence', title: `AI investigation of leak to ${leak.senderName}`, data: { likelySource: src.name, confidence: res.confidence, reasons: res.reasons }, signedBy: res._ai ? 'Gemini analysis, reviewed by user' : 'Rule-based analysis' });
  const investigation = { likelySourceCompanyId: src.id, likelySourceName: src.name, confidence: res.confidence || 'medium', reasons: res.reasons || [], summary: res.summary, chain, ai: res._ai, receiptId: receipt.id, at: nowIso() };
  db.update('leaks', leak.id, { investigation });
  return investigation;
}

export async function processSms({ to, from, text }) {
  const user = db.find('users', u => u.protectedNumber && u.protectedNumber.replace(/\D/g, '') === String(to || '').replace(/\D/g, ''));
  if (!user) throw notFound('No protected number matches ' + to);
  const verdict = await classifySms(user, from, text);
  const base = { channel: 'sms', from, to: user.protectedNumber, subject: String(text).slice(0, 80) };
  if (verdict.allow) {
    logMessage(user.id, { ...base, action: 'forwarded', why: verdict.reason });
    await sendSms({ userId: user.id, to: user.phone, text: `[TraceErase] ${from}: ${text}`, kind: 'forward' });
    return { action: 'forwarded', ...verdict };
  }
  logMessage(user.id, { ...base, action: 'blocked', why: verdict.reason });
  return { action: 'blocked', ...verdict };
}

export async function processCall({ to, from, callerName }) {
  const user = db.find('users', u => u.protectedNumber && u.protectedNumber.replace(/\D/g, '') === String(to || '').replace(/\D/g, ''));
  if (!user) throw notFound('No protected number matches ' + to);
  const verdict = await classifySms(user, callerName || from, `Incoming call from ${callerName || from}`);
  logMessage(user.id, { channel: 'call', from: callerName || from, to: user.protectedNumber, action: verdict.allow ? 'rang' : 'blocked', why: verdict.reason });
  return { action: verdict.allow ? 'rang' : 'blocked', ...verdict };
}

async function classifySms(user, from, text) {
  const companies = db.filter('holdings', h => h.userId === user.id && h.status === 'active').map(h => db.get('companies', h.companyId)?.name).filter(Boolean);
  return withFallback('sms-guard', async () => generate({
    feature: 'sms-guard',
    system: 'You screen calls and SMS for a protected phone number. Allow messages from companies the person uses (orders, deliveries, OTPs). Block spam, loan agents, unknown marketing and scams.',
    prompt: `Companies the person uses: ${companies.join(', ')}.
Sender: ${from}
Message: ${String(text).slice(0, 500)}
Return JSON {"allow":bool,"reason":"short reason","category":"otp|delivery|transaction|marketing|spam|scam|personal"}`,
    json: true, temperature: 0
  }), () => {
    const known = companies.some(c => String(from).toLowerCase().includes(c.toLowerCase().split(' ')[0]));
    const spam = /(loan|lottery|won|prize|kyc update|click here|offer)/i.test(text);
    return { allow: known && !spam, reason: known && !spam ? 'Known company' : spam ? 'Looks like spam' : 'Unknown sender', category: spam ? 'spam' : known ? 'transaction' : 'marketing' };
  });
}
