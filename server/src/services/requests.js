// Deletion requests: build, sign with a passkey, send per company, escalate, verify and certify.
// Companies answer by email (or their web form). AI reads every reply, extracts what was deleted,
// what was kept and which partners received the data; those partners are then asked too.
import { db } from '../db.js';
import { config, usesProtectedEmail } from '../config.js';
import { bad, notFound } from '../http.js';
import { sha256, stableStringify } from '../util/crypto.js';
import { addReceipt } from './ledger.js';
import { createAlert, sendEmail } from './notify.js';
import { draftLetter } from './letters.js';
import { getPolicy, quickPolicy, readPoliciesInBackground } from './policy.js';
import { partnersOf, addressFor, ensureAddress, publicCompany, getOrCreateCompany, upsertHolding, allowSender, rootDomain } from './companies.js';
import { now, nowIso, daysBetween, addDays, withClockOf } from './clock.js';

export const RESOLVED = ['verified', 'partial', 'claimed'];
export const isResolved = (t) => RESOLVED.includes(t.status);
export const SILENCE_DAYS = 30;
const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

function nextNumber(prefix, coll) {
  const n = db.all(coll).filter(x => x.number?.startsWith(prefix)).length + 1;
  return `${prefix}${String(n).padStart(4, '0')}`;
}

function event(target, type, text, extra = {}) {
  const ev = { at: nowIso(), type, text, ...extra };
  db.update('targets', target.id, t => ({ events: [...(t.events || []), ev] }));
  return ev;
}

function channelFor(company) {
  const p = quickPolicy(company);
  return p.deletionMethod === 'webform' || p.deletionMethod === 'in-app' ? 'webform' : 'email';
}

async function newTarget(user, req, company, reason, viaCompanyId) {
  // Drafting must be instant: use what we already know; full policies are read in the background
  const policy = quickPolicy(company);
  return db.insert('targets', {
    requestId: req.id, userId: user.id, companyId: company.id, reason, viaCompanyId,
    channel: channelFor(company), status: 'queued', events: [],
    legalHolds: (policy?.keeps || []).map(k => ({ what: k.what, why: k.why }))
  });
}

/** Build a draft request for the chosen companies plus partners already known to have the data. */
export async function createDraft(user, companyIds) {
  if (!Array.isArray(companyIds) || !companyIds.length) throw bad('Choose at least one company');
  const chosen = companyIds.map(id => db.get('companies', id)).filter(Boolean);
  const list = [];
  const seen = new Set();
  for (const c of chosen) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    list.push({ company: c, reason: 'selected', via: null });
    for (const p of partnersOf(user.id, c.id)) {
      if (seen.has(p.company.id)) continue;
      seen.add(p.company.id);
      list.push({ company: p.company, reason: 'partner', via: c.id });
    }
  }
  const req = db.insert('requests', { userId: user.id, number: nextNumber('DR-', 'requests'), kind: 'deletion', status: 'draft', createdAt: nowIso() });
  for (const t of list) await newTarget(user, req, t.company, t.reason, t.via);
  db.update('requests', req.id, { payloadHash: sha256(stableStringify(requestPayload(req.id))) });
  readPoliciesInBackground(list.map(t => t.company));
  return describeRequest(req.id);
}

export function requestPayload(requestId) {
  const r = db.get('requests', requestId);
  const ts = db.filter('targets', t => t.requestId === requestId);
  return {
    request: r.number, kind: r.kind, userId: r.userId, createdAt: r.createdAt,
    companies: ts.map(t => ({ company: db.get('companies', t.companyId)?.name, reason: t.reason })),
    law: 'Digital Personal Data Protection Act 2023, Sections 8(7) and 12(3)'
  };
}

/** Activate a request after it was signed (passkey) or confirmed. */
export async function activate(user, requestId, { signature = null, autoOtp = true, autoEscalate = true }) {
  const r = db.get('requests', requestId);
  if (!r || r.userId !== user.id) throw notFound('Request not found');
  if (r.status !== 'draft') throw bad('This request was already sent');
  const receipt = addReceipt({
    userId: user.id, kind: 'request-signature', title: `Deletion request ${r.number} signed`,
    data: { request: r.number, payloadHash: r.payloadHash, method: signature ? 'passkey' : 'account confirmation', credentialId: signature?.credentialId || null, userVerified: signature?.userVerified ?? null },
    signedBy: signature ? 'User passkey' : 'User account'
  });
  db.update('requests', r.id, { status: 'active', signedAt: nowIso(), signature, signatureReceiptId: receipt.id, autoOtp, autoEscalate });
  const ts = db.filter('targets', t => t.requestId === r.id);
  // AI writes and sends each letter in the background (a few at a time); the request page updates as they go
  for (const t of ts) db.update('targets', t.id, { status: 'preparing', preparingAt: new Date().toISOString() });
  const run = async () => {
    let i = 0;
    const worker = async () => { while (i < ts.length) { const t = ts[i++]; try { await withClockOf(user, () => dispatch(user, db.get('requests', r.id), db.get('targets', t.id))); } catch (e) { console.error('[dispatch]', e); db.update('targets', t.id, { status: 'queued' }); } } };
    await Promise.all(Array.from({ length: Math.min(4, ts.length) }, worker));
    createAlert(user.id, { type: 'request', title: `Deletion request ${r.number} sent to ${ts.length} ${ts.length === 1 ? 'company' : 'companies'}`, body: 'AI will read every reply. We remind and escalate automatically.', link: `/app/requests/${r.id}` });
  };
  const job = run();
  // Short requests finish before we answer (keeps the demo snappy); long ones carry on in the background
  await Promise.race([job, new Promise(res => setTimeout(res, 8000))]);
  return describeRequest(r.id);
}

async function dispatch(user, req, target) {
  const company = db.get('companies', target.companyId);
  const via = target.viaCompanyId ? db.get('companies', target.viaCompanyId) : null;
  // Identifier the company knows: its own protected address, or the source company's for partners
  const addr = addressFor(user.id, company.id) || (via && addressFor(user.id, via.id)) || null;
  const identifier = addr?.email || user.email;
  // Replies come back to a protected address so AI can read them (one is made just for replies if needed)
  const replyAddr = addr || (usesProtectedEmail(user) ? ensureAddress(user.id, via || company, { purpose: 'replies' }) : null);
  const sentAt = nowIso();
  const base = { sentAt, deadlineAt: addDays(sentAt, config.escalation.legalDeadlineDay), identifier, addressId: replyAddr?.id || null };
  const policy = await getPolicy(company).catch(() => null);
  const kind = target.reason === 'partner' ? 'partner-deletion' : 'deletion';
  const letter = await draftLetter(user, { kind, companyName: company.name, protectedEmail: identifier, requestNumber: req.number, viaCompany: via?.name, language: user.letterLanguage || 'en' });
  const guessed = !policy?.grievanceEmail;
  const to = policy?.grievanceEmail || policy?.suggestedEmail || `privacy@${company.domains?.[0] || 'example.com'}`;
  // A guessed address is never emailed automatically: the person confirms it first
  const realSend = sendsForReal(user, company) && !guessed;
  const out = await sendEmail({
    userId: user.id, to, from: fromLine(user, replyAddr?.email || user.email), subject: letter.subject, text: letter.body, kind: 'deletion-request',
    meta: { targetId: target.id }, deliver: realSend,
    holdNote: guessed && sendsForReal(user, company) ? `Not sent yet: we couldn't confirm ${company.name}'s privacy email. Check the address and press Send.` : 'Ready to send. Real sending to companies is off (SEND_REAL_REQUESTS=false): review it and send it yourself, or turn it on.'
  });
  const letterRec = { ...letter, to, guessedAddress: guessed };
  if (target.channel === 'webform') {
    db.update('targets', target.id, { ...base, status: 'action-needed', delivery: 'manual', letter: letterRec, outboxId: out.id, formUrl: policy?.url || `https://${company.domains?.[0]}` });
    event(target, 'prepared', `${company.name} uses a web form. AI prepared the text for you to paste.`);
  } else {
    const needsSend = sendsForReal(user, company) && !out.delivered;
    db.update('targets', target.id, { ...base, status: needsSend ? 'action-needed' : 'sent', delivery: realSend && out.delivered ? 'email' : 'outbox', letter: letterRec, outboxId: out.id });
    event(target, 'sent', realSend && out.delivered ? `Emailed to ${to}` : needsSend && !guessed ? `Sending to ${to} failed (${out.deliveryNote}). Press Send to try again.` : needsSend ? `Letter ready. Please confirm ${company.name}'s privacy email (${to}) and press Send.` : `AI letter ready in your outbox, addressed to ${to}`, { ai: letter._ai });
  }
}

/** Letters the person sent from their own email: the legal clock starts now. */
export function markSentManually(user, targetId) {
  const t = db.get('targets', targetId);
  if (!t || t.userId !== user.id) throw notFound();
  if (isResolved(t)) throw bad('This company has already answered');
  const sentAt = nowIso();
  const updated = db.update('targets', t.id, { sentAt, deadlineAt: addDays(sentAt, config.escalation.legalDeadlineDay), delivery: 'manual-email', manualSentAt: sentAt, status: ['action-needed', 'sent'].includes(t.status) ? 'sent' : t.status, reminderAt: null, grievanceAt: null });
  event(updated, 'sent', `You emailed it to ${t.letter?.to || db.get('companies', t.companyId)?.name}. The ${config.escalation.legalDeadlineDay}-day clock starts today.`);
  return updated;
}

/** A reply that reached the person's own inbox: they paste it and AI checks it like any other reply. */
export async function pasteReply(user, targetId, { text, subject = '', from = '' }) {
  const t = db.get('targets', targetId);
  if (!t || t.userId !== user.id) throw notFound();
  const body = String(text || '').trim();
  if (body.length < 15) throw bad('Paste the whole reply from the company');
  const company = db.get('companies', t.companyId);
  const { checkReply } = await import('./inbound.js');
  const check = await checkReply(user, company, { subject: String(subject).slice(0, 300), text: body.slice(0, 20000), from: String(from).slice(0, 200), dkim: 'unknown' });
  check.checks = [{ ok: false, text: 'Pasted by you, so the email signature (DKIM) could not be checked' }, ...check.checks.filter(c => !/^Signed by/.test(c.text))];
  return applyReplyCheck(t, check, null);
}

/** The person confirms (or corrects) the company's address and sends a held letter. */
export async function sendHeldLetter(user, targetId, toAddress) {
  const t = db.get('targets', targetId);
  if (!t || t.userId !== user.id) throw notFound();
  if (!t.letter) throw bad('There is no letter for this company yet');
  if (t.delivery === 'email') throw bad('This letter was already emailed');
  const to = String(toAddress || t.letter.to || '').trim().toLowerCase();
  if (!/^[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}$/i.test(to)) throw bad('Enter a valid email address');
  const company = db.get('companies', t.companyId);
  if (!sendsForReal(user, company)) throw bad(user.demo ? 'Demo accounts never email real companies.' : 'Real sending is switched off on this server (SEND_REAL_REQUESTS).');
  const addr = t.addressId && db.get('addresses', t.addressId);
  const out = await sendEmail({ userId: user.id, to, from: fromLine(user, addr?.email || t.identifier), subject: t.letter.subject, text: t.letter.body, kind: 'deletion-request', meta: { targetId: t.id }, deliver: true });
  if (!out.delivered) throw bad(out.deliveryNote || 'Sending failed');
  // The legal clock starts when the company actually receives it
  const sentAt = nowIso();
  const updated = db.update('targets', t.id, { letter: { ...t.letter, to, guessedAddress: false }, delivery: 'email', outboxId: out.id, sentAt, deadlineAt: addDays(sentAt, config.escalation.legalDeadlineDay), status: t.status === 'action-needed' ? 'sent' : t.status });
  event(updated, 'sent', `Emailed to ${to}`);
  return updated;
}

export function markWebformSubmitted(user, targetId, reference) {
  const t = db.get('targets', targetId);
  if (!t || t.userId !== user.id) throw notFound();
  db.update('targets', t.id, { status: 'sent', reference: reference || t.reference, sentAt: nowIso(), deadlineAt: addDays(nowIso(), config.escalation.legalDeadlineDay) });
  event(t, 'sent', `You submitted the web form${reference ? `, ticket ${reference}` : ''}`);
  return describeTarget(t.id);
}

/**
 * Partners a company named in its reply. Creates disclosure receipts, holdings and,
 * if the request is still active, partner targets that are sent right away.
 */
export async function recordDisclosedPartners(user, target, partners, sourceNote) {
  const company = db.get('companies', target.companyId);
  const req = db.get('requests', target.requestId);
  const addr = target.addressId ? db.get('addresses', target.addressId) : addressFor(user.id, company.id);
  const added = [];
  for (const p of partners || []) {
    if (!p?.name) continue;
    const domain = rootDomain(p.domain || '');
    const pc = getOrCreateCompany({ name: p.name, domain, category: /advert|market|ads?\b/i.test(p.purpose || '') ? 'Advertising' : 'Other' });
    if (pc.id === company.id) continue;
    if (db.find('receipts', r => r.kind === 'share' && r.userId === user.id && r.companyId === company.id && r.data?.partnerCompanyId === pc.id)) continue;
    const fields = (p.fields && p.fields.length ? p.fields : ['email']).map(String);
    const receipt = addReceipt({
      userId: user.id, companyId: company.id, kind: 'share', title: `${company.name} named ${pc.name} as a recipient of your data`,
      data: { from: company.name, partner: pc.name, partnerCompanyId: pc.id, user: target.identifier, fields, purpose: p.purpose || 'Not stated', keepUntil: null, source: sourceNote },
      signedBy: sourceNote
    });
    upsertHolding(user.id, pc, { sources: ['disclosure'], viaCompanyId: company.id, dataTypes: fields.map(f => f[0].toUpperCase() + f.slice(1)) });
    if (addr && !/market|advert|ads?\b|promot/i.test(p.purpose || '')) for (const d of pc.domains || []) allowSender(user.id, addr.id, d);
    added.push({ company: pc, receipt });
    if (req && req.status === 'active' && !db.find('targets', t => t.requestId === req.id && t.companyId === pc.id)) {
      const t = await newTarget(user, req, pc, 'partner', company.id);
      await dispatch(user, req, t);
    }
  }
  if (added.length) {
    createAlert(user.id, { type: 'share', severity: 'info', title: `${company.name} shared your data with ${added.map(a => a.company.name).join(' and ')}`, body: req?.status === 'active' ? 'We sent each of them a deletion request too.' : 'Recorded from their reply.', link: `/app/companies/${company.id}` });
  }
  return added;
}

/** A reply from the company, already checked by AI (see inbound.js). */
export async function applyReplyCheck(target, check, messageId) {
  const user = db.get('users', target.userId);
  const company = db.get('companies', target.companyId);
  const resolvedNow = check.isConfirmation && check.verdict !== 'not-genuine';
  const kept = (check.kept || []).map(k => ({ field: k.what || k.field || String(k), law: k.why || k.law || 'Not stated' }));
  const status = resolvedNow ? (kept.length ? 'partial' : 'claimed') : check.isRefusal ? 'refused' : target.status === 'action-needed' ? 'sent' : target.status === 'no-response' ? 'awaiting-reply' : target.status;
  let receiptId = target.receiptId;
  if (resolvedNow) {
    receiptId = addReceipt({
      userId: target.userId, companyId: company.id, kind: 'deletion', title: `${company.name} confirmed deletion`,
      data: { request: db.get('requests', target.requestId)?.number, reference: check.reference, deleted: check.deleted || [], kept, dkim: check.dkim, checks: check.checks },
      signedBy: check.dkim === 'pass' ? `DKIM-signed email from ${company.domains?.[0]}` : 'Email (no valid signature)'
    }).id;
  }
  db.update('targets', target.id, {
    status, replyCheck: check, reference: check.reference || target.reference, receiptId,
    resolvedAt: resolvedNow ? nowIso() : target.resolvedAt,
    result: resolvedNow ? { deleted: check.deleted || [], kept } : target.result
  });
  event(target, resolvedNow ? (kept.length ? 'partial' : 'claimed') : check.isRefusal ? 'refused' : 'reply',
    resolvedNow ? `Replied: deleted${kept.length ? `, kept ${kept.map(k => k.field).join(', ')}` : ''}${check.reference ? ` · ref ${check.reference}` : ''}. AI checked it.` : `Replied: ${check.summary || 'not a confirmation yet'}`,
    { messageId, receiptId: resolvedNow ? receiptId : undefined });
  const h = db.find('holdings', x => x.userId === target.userId && x.companyId === company.id);
  if (h && resolvedNow) db.update('holdings', h.id, { status });
  if (check.sharedWith?.length) await recordDisclosedPartners(user, db.get('targets', target.id), check.sharedWith, check.dkim === 'pass' ? `DKIM-signed reply from ${company.domains?.[0]}` : `Reply from ${company.name}`);
  if (resolvedNow) checkCompletion(target.requestId);
  return db.get('targets', target.id);
}

function checkCompletion(requestId) {
  const r = db.get('requests', requestId);
  const ts = db.filter('targets', t => t.requestId === requestId);
  if (r.status === 'active' && ts.every(isResolved)) {
    db.update('requests', r.id, { status: 'completed', completedAt: nowIso() });
    createAlert(r.userId, { type: 'certificate', severity: 'good', title: `All companies answered ${r.number}`, body: 'Your deletion certificate is ready.', link: `/app/requests/${r.id}` });
  }
}

/**
 * "Verified" without any company integration: a confirmed deletion becomes verified after
 * SILENCE_DAYS with no message at all to the protected address that only this company had.
 */
function verifyBySilence(user) {
  for (const t of db.filter('targets', x => x.userId === user.id && x.status === 'claimed' && x.resolvedAt && x.addressId)) {
    if (daysBetween(t.resolvedAt, now()) < SILENCE_DAYS) continue;
    const company = db.get('companies', t.companyId);
    const addr = db.get('addresses', t.addressId);
    // silence only proves something for an address that only this company knew you by
    if (!addr || addr.companyId !== company.id || t.identifier !== addr.email) continue;
    // (the confirmation itself is logged a moment after resolvedAt, so start counting 5 minutes later)
    const after = db.filter('messages', m => m.addressId === addr.id && new Date(m.at) > new Date(new Date(t.resolvedAt).getTime() + 300000));
    if (after.length) continue;
    const receipt = addReceipt({
      userId: t.userId, companyId: company.id, kind: 'deletion', title: `${company.name} deletion verified by ${SILENCE_DAYS} days of silence`,
      data: { address: addr.email, since: t.resolvedAt, messagesSince: 0, method: 'canary silence' }, signedBy: 'TraceErase protected inbox'
    });
    db.update('targets', t.id, { status: 'verified', verifiedAt: nowIso(), verifyReceiptId: receipt.id });
    event(t, 'verified', `Verified: no one used your ${company.name}-only address for ${SILENCE_DAYS} days after deletion`, { receiptId: receipt.id });
    createAlert(t.userId, { type: 'reply', severity: 'good', title: `${company.name} deletion verified`, body: `Your ${company.name}-only address stayed silent for ${SILENCE_DAYS} days.`, link: `/app/requests/${t.requestId}` });
  }
}

// ---------- escalation (runs every minute and after the demo clock moves) ----------
let escalating = false;
export async function escalate({ userId = null } = {}) {
  if (escalating && !userId) return;
  if (!userId) escalating = true;
  try {
    // Each account is checked against its own clock (demo accounts may have moved theirs forward)
    const users = userId ? [db.get('users', userId)].filter(Boolean)
      : db.filter('users', u => db.find('targets', t => t.userId === u.id && ['sent', 'no-response', 'awaiting-reply', 'claimed', 'preparing'].includes(t.status)));
    for (const user of users) await withClockOf(user, () => escalateUser(user));
  } finally { if (!userId) escalating = false; }
}

async function escalateUser(user) {
  const { reminderDay, grievanceDay, complaintDay } = config.escalation;
  // Letters interrupted by a server restart are finished here
  for (const t of db.filter('targets', x => x.userId === user.id && x.status === 'preparing' && Date.now() - new Date(x.preparingAt || 0).getTime() > 180000)) {
    const req = db.get('requests', t.requestId);
    if (req?.status !== 'active') continue;
    db.update('targets', t.id, { preparingAt: new Date().toISOString() });
    await dispatch(user, req, db.get('targets', t.id)).catch(e => console.error('[dispatch retry]', e.message));
  }
  for (const t of db.filter('targets', x => x.userId === user.id && ['sent', 'no-response', 'awaiting-reply'].includes(x.status) && x.sentAt)) {
    const req = db.get('requests', t.requestId);
    if (!req || req.status !== 'active' || req.autoEscalate === false) continue;
    const company = db.get('companies', t.companyId);
    const age = daysBetween(t.sentAt, now());
    if (age >= reminderDay && !t.reminderAt) {
      await followUp(user, req, t, company, 'reminder');
      db.update('targets', t.id, { reminderAt: nowIso(), status: 'no-response' });
    }
    const t2 = db.get('targets', t.id);
    if (!['sent', 'no-response', 'awaiting-reply'].includes(t2.status)) continue;
    if (age >= grievanceDay && !t2.grievanceAt) {
      await followUp(user, req, t2, company, 'grievance');
      db.update('targets', t.id, { grievanceAt: nowIso() });
    }
    const t3 = db.get('targets', t.id);
    if (age >= complaintDay && !t3.overdueAt && ['sent', 'no-response', 'awaiting-reply'].includes(t3.status)) {
      db.update('targets', t.id, { status: 'overdue', overdueAt: nowIso() });
      event(t3, 'overdue', `No reply after ${complaintDay} days. Complaint prepared.`);
      const { buildPack } = await import('./evidence.js');
      const { draftComplaint, fileComplaint } = await import('./complaints.js');
      const pack = await buildPack(user, { targetId: t.id });
      const complaint = await draftComplaint(user, { packId: pack.id });
      db.update('targets', t.id, { complaintId: complaint.id, packId: pack.id });
      if (user.settings?.autoFile) await fileComplaint(user, complaint.id, { auto: true });
      else createAlert(user.id, { type: 'complaint', severity: 'warn', needsAction: true, title: `Complaint ready against ${company.name}`, body: `${complaintDay} days with no reply to your request, reminder and grievance.`, link: `/app/complaints/${complaint.id}`, refId: complaint.id });
    }
  }
  verifyBySilence(user);
  // Demo accounts: the pretend companies answer on their schedule
  if (user.demo && config.demoMode) {
    const { demoReplies } = await import('./demo.js');
    await demoReplies({ userId: user.id });
  }
}

/** Letters to companies come from the person, at their protected address. */
export const fromLine = (user, email) => `${String(user?.name || 'TraceErase user').replace(/["<>\r\n]/g, '').slice(0, 60)} <${email}>`;

/** Real emails go to real companies only for real accounts, when sending is switched on. */
export const sendsForReal = (user, company) => !!(config.sendRequestsForReal && !user?.demo && !company?.fictional && usesProtectedEmail(user));

async function followUp(user, req, t, company, kind) {
  const letter = await draftLetter(user, { kind, companyName: company.name, protectedEmail: t.identifier, requestNumber: req.number, sentOn: fmtDate(t.sentAt), language: user.letterLanguage || 'en' });
  const out = await sendEmail({ userId: user.id, to: t.letter?.to || `privacy@${company.domains?.[0]}`, from: fromLine(user, (t.addressId && db.get('addresses', t.addressId)?.email) || t.identifier), subject: letter.subject, text: letter.body, kind, deliver: sendsForReal(user, company) && t.delivery === 'email', holdNote: 'Ready to send (real sending is off).' });
  const what = kind === 'reminder' ? 'Reminder' : 'Formal grievance';
  // When letters are sent by the person from their own email, ask them to send this one too
  const manual = !out.delivered && !user.demo;
  event(t, kind, manual ? `${what} ready: send it from your email (below)` : `${what} sent`, { letter: { ...letter, to: t.letter?.to } });
  if (manual) createAlert(user.id, { type: 'deadline', severity: 'warn', needsAction: true, title: `Send the ${what.toLowerCase()} to ${company.name}`, body: `No reply after ${daysBetween(t.sentAt, now())} days. The letter is ready to copy or open in your mail app.`, link: `/app/requests/${req.id}/targets/${t.id}` });
  addReceipt({ userId: user.id, companyId: company.id, kind: 'message', title: `${kind === 'reminder' ? 'Reminder' : 'Grievance'} for ${req.number} to ${company.name}`, data: { request: req.number, kind, subject: letter.subject, sentAt: nowIso() }, signedBy: 'TraceErase delivery log' });
  if (kind === 'grievance' && !manual) createAlert(user.id, { type: 'deadline', severity: 'warn', title: `Grievance sent to ${company.name}`, body: 'They ignored your request and a reminder.', link: `/app/requests/${req.id}` });
}

// ---------- read models ----------
export function describeTarget(targetId) {
  const t = db.get('targets', targetId);
  if (!t) return null;
  const c = db.get('companies', t.companyId);
  const via = t.viaCompanyId ? db.get('companies', t.viaCompanyId) : null;
  const age = t.sentAt ? daysBetween(t.sentAt, now()) : 0;
  const addr = t.addressId ? db.get('addresses', t.addressId) : null;
  const watchable = addr && addr.companyId === t.companyId && t.identifier === addr.email;
  const silenceLeft = t.status === 'claimed' && t.resolvedAt && watchable ? Math.max(0, SILENCE_DAYS - daysBetween(t.resolvedAt, now())) : null;
  const canSend = !!(t.letter && t.channel !== 'webform' && t.delivery !== 'email' && !isResolved(t) && sendsForReal(db.get('users', t.userId), c));
  return { ...t, company: publicCompany(c), via: via ? publicCompany(via) : null, day: age, resolved: isResolved(t), silenceLeft, canSend };
}

export function describeRequest(requestId) {
  const r = db.get('requests', requestId);
  if (!r) return null;
  const targets = db.filter('targets', t => t.requestId === r.id).map(t => describeTarget(t.id));
  const resolved = targets.filter(t => t.resolved).length;
  const day = r.signedAt ? daysBetween(r.signedAt, now()) : 0;
  const counts = targets.reduce((m, t) => ({ ...m, [t.status]: (m[t.status] || 0) + 1 }), {});
  const cert = db.find('certificates', c => c.requestId === r.id);
  const { reminderDay, grievanceDay, complaintDay } = config.escalation;
  const steps = [
    { key: 'sent', label: 'Sent', day: 0 },
    { key: 'reminder', label: 'Reminder', day: reminderDay },
    { key: 'grievance', label: 'Grievance', day: grievanceDay },
    { key: 'complaint', label: 'Complaint ready', day: complaintDay },
    { key: 'board', label: 'Board decides', day: null }
  ].map(s => ({ ...s, state: s.day === null ? (targets.some(t => t.complaintId) ? 'current' : 'todo') : day > s.day ? 'done' : day === s.day ? 'current' : 'todo' }));
  return { ...r, targets, resolved, total: targets.length, day, counts, steps, certificateId: cert?.id || null };
}

export function listRequests(userId) {
  return db.filter('requests', r => r.userId === userId && r.status !== 'draft').map(r => describeRequest(r.id)).reverse();
}

export function issueCertificate(user, requestId) {
  const r = describeRequest(requestId);
  if (!r || r.userId !== user.id) throw notFound('Request not found');
  if (r.status === 'draft') throw bad('Send the request first');
  const existing = db.find('certificates', c => c.requestId === r.id);
  const sig = r.targets.map(t => t.status).join(',');
  if (existing && existing.statusSig === sig) return existing;
  const rows = r.targets.map(t => ({
    company: t.company.name, status: t.status,
    kept: (t.result?.kept || []).map(k => `${k.field} (${k.law})`).join('; ') || (isResolved(t) ? 'Nothing' : t.complaintReference ? `Complaint ${t.complaintReference}` : t.complaintId ? 'Complaint prepared' : '—'),
    receiptId: t.verifyReceiptId || t.receiptId || null,
    hash: (t.verifyReceiptId || t.receiptId) ? db.get('receipts', t.verifyReceiptId || t.receiptId)?.hash : null
  }));
  const number = existing?.number || `DC-${now().getFullYear()}-${r.number.replace('DR-', '')}`;
  const receipt = addReceipt({ userId: user.id, kind: 'certificate', title: `Deletion certificate ${number}`, data: { number, request: r.number, rows }, signedBy: 'TraceErase' });
  const rec = { userId: user.id, requestId: r.id, number, rows, statusSig: sig, resolvedCount: r.resolved, total: r.total, issuedAt: nowIso(), receiptId: receipt.id };
  if (existing) return db.update('certificates', existing.id, rec);
  return db.insert('certificates', rec);
}

/** Open target for a company (a reply from that company belongs to it). */
export function activeTargetFor(userId, companyId) {
  return db.filter('targets', t => t.userId === userId && t.companyId === companyId && !isResolved(t) && !['queued', 'refused'].includes(t.status)).at(-1) || null;
}

let timer;
export function startEscalation() {
  clearInterval(timer);
  timer = setInterval(() => escalate().catch(e => console.error('[escalate]', e)), 60000);
}
export { ensureAddress };
