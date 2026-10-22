// AI complaint drafter for the Data Protection Board of India.
import { db } from '../db.js';
import { bad, notFound } from '../http.js';
import { generate, withFallback, maskFor } from '../ai/gemini.js';
import { addReceipt } from './ledger.js';
import { createAlert } from './notify.js';
import { nowIso, now } from './clock.js';

const fmt = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

function factsFor(user, pack) {
  const facts = [];
  const target = pack.targetId && db.get('targets', pack.targetId);
  if (target) {
    const company = db.get('companies', target.companyId);
    const req = db.get('requests', target.requestId);
    const via = target.viaCompanyId && db.get('companies', target.viaCompanyId);
    facts.push(`On ${fmt(req.signedAt)} the complainant asked ${via ? via.name + ' and its partners' : company.name} to delete their personal data (request ${req.number})${req.signature ? ', signed with a passkey' : ''}.`);
    const share = db.filter('receipts', r => r.kind === 'share' && r.userId === user.id && r.data?.partnerCompanyId === company.id).at(-1);
    if (share) facts.push(`In its written reply of ${fmt(share.issuedAt)}, ${db.get('companies', share.companyId)?.name} stated that it had shared the complainant's ${(share.data.fields || []).join(', ')} with ${company.name} (purpose: ${share.data.purpose || 'not stated'}).`);
    if (target.reminderAt) facts.push(`${company.name} did not respond to the request or to a reminder sent on ${fmt(target.reminderAt)}.`);
    if (target.grievanceAt) facts.push(`A formal grievance was sent on ${fmt(target.grievanceAt)} and was also ignored.`);
  }
  const leak = pack.leakId && db.get('leaks', pack.leakId);
  if (leak) {
    const comp = db.get('companies', leak.companyId);
    facts.push(`On ${fmt(leak.at)}, ${leak.senderName || leak.senderDomain} sent a message to the email address the complainant had given only to ${comp.name}. The complainant never had any relationship with ${leak.senderName || leak.senderDomain}.`);
  }
  return facts;
}

export async function draftComplaint(user, { packId }) {
  const pack = db.get('evidence', packId);
  if (!pack || pack.userId !== user.id) throw notFound('Evidence pack not found');
  const existing = db.find('complaints', c => c.packId === packId && c.status === 'draft');
  if (existing) return existing;
  const facts = factsFor(user, pack);
  const parties = [];
  const target = pack.targetId && db.get('targets', pack.targetId);
  if (target) { const c = db.get('companies', target.companyId); parties.push({ companyId: c.id, name: c.name, issue: target.viaCompanyId ? 'Ignored deletion, passed data on' : 'Ignored deletion request' }); }
  const leak = pack.leakId && db.get('leaks', pack.leakId);
  if (leak) parties.push({ companyId: null, name: leak.senderName || leak.senderDomain, issue: 'Used data it was never given' });

  const { mask, unmask } = maskFor(user);
  const res = await withFallback('complaint-drafter', async () => generate({
    feature: 'complaint-drafter',
    system: 'You draft clear, factual complaints to the Data Protection Board of India under the Digital Personal Data Protection Act, 2023. Use only the facts given. Formal but plain English. No markdown.',
    prompt: `Facts (use all of them, in order, and nothing else):
${facts.map((f, i) => `${i + 1}. ${mask(f)}`).join('\n')}
Respondents: ${parties.map(p => p.name).join(', ')}.
Write the "What happened" section in first person ("I"), under 140 words.
Also list what the complainant asks the Board to do (2 to 3 items).
Return JSON {"summary":"...","asks":["..."]}`,
    json: true, temperature: 0.2
  }), () => ({
    summary: facts.map(f => f.replace(/the complainant('s)?/gi, (m) => m.endsWith("'s") ? 'my' : 'I').replace(/^On (.*?) I asked/, 'On $1 I asked')).join(' '),
    asks: ['Order the respondents to delete my data and confirm it in writing', 'Investigate how my data reached a company I never dealt with', 'Take action for repeated failures']
  }));
  return db.insert('complaints', {
    userId: user.id, packId, status: 'draft', to: 'Data Protection Board of India', parties,
    summary: unmask(res.summary), asks: (res.asks || []).map(unmask), ai: res._ai, draftedAt: nowIso()
  });
}

export async function fileComplaint(user, complaintId, { summary, asks, auto = false } = {}) {
  const c = db.get('complaints', complaintId);
  if (!c || c.userId !== user.id) throw notFound('Complaint not found');
  if (c.status === 'filed') throw bad('Already filed');
  const reference = `DPB-${now().getFullYear()}-${String(8800 + db.filter('complaints', x => x.status === 'filed').length + 1)}`;
  const patch = { status: 'filed', filedAt: nowIso(), reference, autoFiled: auto };
  if (summary) patch.summary = summary;
  if (asks) patch.asks = asks;
  const updated = db.update('complaints', c.id, patch);
  const receipt = addReceipt({ userId: user.id, kind: 'complaint', title: `Complaint ${reference}`, data: { reference, parties: c.parties.map(p => p.name), summary: updated.summary, asks: updated.asks, packId: c.packId }, signedBy: 'User account' });
  db.update('complaints', c.id, { receiptId: receipt.id });
  for (const t of db.filter('targets', x => x.complaintId === c.id)) db.update('targets', t.id, { complaintReference: reference });
  createAlert(user.id, { type: 'complaint', severity: 'info', title: `Complaint ${reference} ${auto ? 'filed automatically' : 'filed'}`, body: `Against ${c.parties.map(p => p.name).join(' and ')}. We'll track it in the regulator view.`, link: `/app/complaints/${c.id}` });
  return db.get('complaints', c.id);
}
