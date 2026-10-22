// Evidence packs: timestamped, fingerprinted records that together prove what happened.
import { db } from '../db.js';
import { bad, notFound } from '../http.js';
import { addReceipt } from './ledger.js';
import { nowIso } from './clock.js';

function item(receipt, label, proves, source) {
  if (!receipt) return null;
  return { receiptId: receipt.id, label, proves, source, at: receipt.issuedAt, hash: receipt.hash };
}

/** Build a pack for an ignored deletion target and/or a leak. */
export async function buildPack(user, { targetId = null, leakId = null }) {
  const items = [];
  const against = new Set();
  let title = 'Evidence pack';
  const target = targetId ? db.get('targets', targetId) : null;
  const leak = leakId ? db.get('leaks', leakId) : null;
  if ((targetId && target?.userId !== user.id) || (leakId && leak?.userId !== user.id)) throw notFound('Not found');
  if (!target && !leak) throw bad('Choose a deletion request or a leak to build evidence from');
  const linkedTarget = target || (leak?.investigation?.likelySourceCompanyId && db.filter('targets', t => t.userId === user.id && t.companyId === leak.investigation.likelySourceCompanyId).at(-1));

  if (linkedTarget) {
    const company = db.get('companies', linkedTarget.companyId);
    against.add(company.id);
    title = `${company.name}${leak ? ' and ' + (leak.senderName || leak.senderDomain) : ''}`;
    const req = db.get('requests', linkedTarget.requestId);
    // how the company got the data
    const viaShare = db.filter('receipts', r => r.kind === 'share' && r.userId === user.id && r.data?.partnerCompanyId === company.id).at(-1);
    if (viaShare) items.push(item(viaShare, `${db.get('companies', viaShare.companyId)?.name}'s disclosure`, `${db.get('companies', viaShare.companyId)?.name} said in writing that it gave your data to ${company.name}`, viaShare.signedBy || 'Company reply'));
    const sig = req?.signatureReceiptId && db.get('receipts', req.signatureReceiptId);
    if (sig) items.push(item(sig, 'Your signed deletion request', 'Proves you asked for deletion', sig.data?.method === 'passkey' ? 'Your passkey' : 'Your account'));
    const follow = db.filter('receipts', r => r.kind === 'message' && r.userId === user.id && r.companyId === company.id && r.data?.request === req?.number);
    if (follow.length) items.push(item(follow.at(-1), follow.length > 1 ? 'Reminder and grievance' : 'Reminder', `Proves they were warned ${follow.length === 1 ? 'once' : follow.length + ' times'}`, 'Delivery log'));
  }
  if (leak) {
    against.add(`sender:${leak.senderDomain}`);
    const lr = db.get('receipts', leak.receiptId);
    if (lr) items.push(item(lr, `${leak.senderName || leak.senderDomain}'s message`, `Proves a stranger had your ${db.get('companies', leak.companyId)?.name}-only address`, 'Protected inbox'));
    const ir = leak.investigation?.receiptId && db.get('receipts', leak.investigation.receiptId);
    if (ir) items.push(item(ir, 'AI investigation report', 'Explains how the leak happened', 'AI, reviewed by you'));
    if (!linkedTarget) title = `${db.get('companies', leak.companyId)?.name} leak to ${leak.senderName || leak.senderDomain}`;
  }
  const clean = items.filter(Boolean);
  const number = `EP-${String(db.all('evidence').length + 1).padStart(4, '0')}`;
  const receipt = addReceipt({ userId: user.id, kind: 'evidence', title: `Evidence pack ${number}`, data: { number, items: clean.map(i => ({ label: i.label, hash: i.hash })) }, signedBy: 'TraceErase' });
  return db.insert('evidence', { userId: user.id, number, title, targetId: linkedTarget?.id || null, leakId, against: [...against], items: clean, receiptId: receipt.id, builtAt: nowIso() });
}

export function getPack(user, id) {
  const p = db.get('evidence', id);
  if (!p || p.userId !== user.id) throw notFound('Evidence pack not found');
  return p;
}
