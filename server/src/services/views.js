// Read models for the dashboard, companies list, company page and data map.
import { db } from '../db.js';
import { notFound } from '../http.js';
import { generate, withFallback } from '../ai/gemini.js';
import { publicCompany, addressFor, partnersOf } from './companies.js';
import { describeRequest, isResolved } from './requests.js';
import { companyScores } from './stats.js';
import { getPolicy } from './policy.js';
import { now, nowIso, daysBetween } from './clock.js';

const lastTarget = (userId, companyId) => db.filter('targets', t => t.userId === userId && t.companyId === companyId && t.status !== 'queued').at(-1) || null;

export function holdingRow(h) {
  const c = db.get('companies', h.companyId);
  const t = lastTarget(h.userId, c.id);
  const addr = addressFor(h.userId, c.id);
  const partners = partnersOf(h.userId, c.id);
  const pol = db.find('policies', p => p.companyId === c.id);
  const leaks = db.filter('leaks', l => l.userId === h.userId && (l.investigation?.likelySourceCompanyId === c.id)).length;
  return {
    id: c.id, holdingId: h.id, company: publicCompany(c), dataTypes: h.dataTypes?.length ? h.dataTypes : c.dataTypes,
    sources: h.sources, lastSeen: h.lastSeen, daysSinceUse: h.lastSeen ? daysBetween(h.lastSeen, now()) : null,
    via: h.viaCompanyId ? publicCompany(db.get('companies', h.viaCompanyId)) : null,
    partnersCount: partners.length || (pol?.sharesWith?.length ?? (c.partnerTypes || []).length),
    partnersKnown: partners.length > 0,
    channel: pol?.deletionMethod === 'in-app' || pol?.deletionMethod === 'webform' ? 'webform' : 'email',
    status: t ? t.status : 'not-asked', targetId: t?.id || null, requestId: t?.requestId || null,
    address: addr ? { id: addr.id, email: addr.email, leaks: addr.leaks } : null, usingProtected: !!h.usingProtected || (!!addr && addr.purpose !== 'replies'),
    leaks, fix: h.fix || null
  };
}

export function companiesList(userId) {
  return db.filter('holdings', h => h.userId === userId).map(holdingRow)
    .sort((a, b) => (b.leaks - a.leaks) || (b.partnersCount - a.partnersCount) || ((a.daysSinceUse ?? 9e9) - (b.daysSinceUse ?? 9e9)));
}

export async function companyDetail(user, companyId) {
  const c = db.get('companies', companyId);
  const h = db.find('holdings', x => x.userId === user.id && x.companyId === companyId);
  if (!c || !h) throw notFound('Company not found');
  const row = holdingRow(h);
  const policy = await getPolicy(c).catch(() => null);
  const partners = partnersOf(user.id, c.id).map(p => {
    const t = lastTarget(user.id, p.company.id);
    const r = p.receipts.at(-1);
    return { company: publicCompany(p.company), receiptId: r.id, hash: r.hash, fields: r.data.fields, purpose: r.data.purpose, keepUntil: r.data.keepUntil, sharedAt: r.issuedAt, status: t?.status || 'not-asked' };
  });
  const addr = addressFor(user.id, c.id);
  const t = lastTarget(user.id, c.id);
  const history = [
    { at: h.firstSeen, icon: 'user', text: h.sources?.includes('google-signin') ? 'Signed up with Google' : h.via ? `Received your data from ${h.via.name}` : 'Found in your inbox', sub: h.sources?.join(', ') },
    ...(addr ? [{ at: addr.createdAt, icon: 'shield', text: 'Protected email created', sub: addr.email }] : []),
    ...db.filter('receipts', r => r.userId === user.id && r.companyId === c.id && r.kind === 'share').map(r => ({ at: r.issuedAt, icon: 'share', text: `Shared your data with ${r.data.partner}`, sub: 'Said so in its reply', receiptId: r.id })),
    ...(t ? (t.events || []).map(e => ({ at: e.at, icon: e.type === 'sent' ? 'send' : ['verified', 'partial', 'claimed'].includes(e.type) ? 'receipt' : e.type === 'overdue' ? 'alert' : 'clock', text: e.text, receiptId: e.receiptId })) : [])
  ].filter(x => x.at).sort((a, b) => new Date(a.at) - new Date(b.at));
  const score = companyScores().rows.find(r => r.company.id === c.id) || null;
  const deletionReceipt = t?.receiptId ? db.get('receipts', t.receiptId) : null;
  return {
    ...row, policy, partners, history, score,
    allowed: addr?.allowed || [], blockedSenders: addr?.blockedSenders || [],
    target: t ? { id: t.id, status: t.status, requestId: t.requestId, result: t.result, receiptId: t.receiptId, legalHolds: t.legalHolds } : null,
    deletionReceipt: deletionReceipt ? { id: deletionReceipt.id, hash: deletionReceipt.hash, data: deletionReceipt.data } : null
  };
}

export function dataMap(userId) {
  const rows = companiesList(userId);
  const direct = rows.filter(r => !r.via);
  const withPartners = direct.filter(r => r.partnersKnown);
  const others = direct.filter(r => !r.partnersKnown).sort((a, b) => (a.daysSinceUse ?? 9e9) - (b.daysSinceUse ?? 9e9));
  const shown = [...withPartners, ...others].slice(0, 6);
  const edges = [];
  const partnerNodes = new Map();
  for (const r of shown) {
    for (const p of partnersOf(userId, r.id)) {
      const t = lastTarget(userId, p.company.id);
      partnerNodes.set(p.company.id, { id: p.company.id, name: p.company.name, color: p.company.color, status: t?.status || 'not-asked' });
      edges.push({ from: r.id, to: p.company.id, kind: t && ['overdue', 'no-response'].includes(t.status) ? 'ignored' : 'shared', receiptId: p.receipts.at(-1).id });
    }
  }
  const leakNodes = db.filter('leaks', l => l.userId === userId).map(l => ({ id: l.id, name: l.senderName, from: l.investigation?.likelySourceCompanyId || l.companyId }));
  return {
    companies: shown.map(r => ({ id: r.id, name: r.company.name, color: r.company.color, status: r.status, category: r.company.category })),
    partners: [...partnerNodes.values()], leaks: leakNodes, edges, more: Math.max(0, direct.length - shown.length)
  };
}

function privacyScore(userId, rows) {
  const unused = rows.filter(r => (r.daysSinceUse ?? 0) > 365 && r.status === 'not-asked');
  const real = rows.filter(r => !r.usingProtected && !r.via);
  const leaks = db.filter('leaks', l => l.userId === userId && l.status === 'open');
  const overdue = rows.filter(r => r.status === 'overdue');
  const pen = Math.min(30, unused.length * 1.5) + Math.min(20, real.length * 0.6) + leaks.length * 8 + overdue.length * 4;
  const score = Math.max(5, Math.round(100 - pen));
  const tips = [];
  if (unused.length) tips.push({ text: `Delete ${unused.length} unused account${unused.length > 1 ? 's' : ''}`, points: Math.round(Math.min(30, unused.length * 1.5)), to: '/app/delete' });
  if (overdue.length) tips.push({ text: `File the ${overdue[0].company.name} complaint`, points: 4 * overdue.length, to: '/app/complaints' });
  if (real.length) tips.push({ text: `Switch ${real.length} old account${real.length > 1 ? 's' : ''} to protected emails`, points: Math.round(Math.min(20, real.length * 0.6)), to: '/app/companies?filter=real' });
  if (leaks.length) tips.push({ text: 'Deal with the open leak', points: 8 * leaks.length, to: `/app/leaks/${leaks[0].id}` });
  return { score, label: score >= 80 ? 'Good' : score >= 60 ? 'Fair' : 'Needs work', tips: tips.slice(0, 3) };
}

export async function dashboard(user) {
  const rows = companiesList(user.id);
  const reqs = db.filter('requests', r => r.userId === user.id && r.status !== 'draft');
  const active = reqs.filter(r => r.status === 'active').at(-1) || reqs.at(-1);
  const targets = db.filter('targets', t => t.userId === user.id && t.status !== 'queued');
  const leaks = db.filter('leaks', l => l.userId === user.id);
  const openLeak = leaks.filter(l => l.status === 'open').at(-1);
  const cats = {};
  for (const r of rows.filter(x => !x.via)) cats[r.company.category] = (cats[r.company.category] || 0) + 1;
  const needs = [];
  for (const a of db.filter('alerts', a => a.userId === user.id && a.needsAction && !a.read).slice(-5).reverse()) needs.push({ id: a.id, type: a.type, title: a.title, body: a.body, link: a.link });
  for (const t of targets.filter(t => t.status === 'action-needed')) needs.push({ type: 'webform', title: `Submit ${db.get('companies', t.companyId)?.name}'s web form`, body: 'We prepared the text for you', link: `/app/requests/${t.requestId}/targets/${t.id}` });
  const realEmail = rows.filter(r => !r.usingProtected && !r.via).length;
  if (realEmail) needs.push({ type: 'switch', title: `Switch ${realEmail} old accounts`, body: 'to protected emails', link: '/app/companies?filter=real' });

  const today = nowIso().slice(0, 10);
  let summary = db.get('meta', 'summary-' + user.id);
  if (!summary || summary.day !== today || summary.version !== targets.length + leaks.length) {
    const facts = {
      companies: rows.length, deleted: targets.filter(isResolved).map(t => db.get('companies', t.companyId)?.name),
      pending: targets.filter(t => !isResolved(t)).map(t => ({ name: db.get('companies', t.companyId)?.name, status: t.status, day: t.sentAt ? daysBetween(t.sentAt, now()) : 0 })),
      leaks: leaks.map(l => ({ sender: l.senderName, source: l.investigation?.likelySourceName }))
    };
    const res = await withFallback('daily-summary', async () => generate({
      feature: 'daily-summary',
      system: 'You write a 2-sentence daily privacy update for one person. Specific, calm, no hype.',
      prompt: `Facts: ${JSON.stringify(facts)}. Return JSON {"text":"max 45 words"}`, json: true, temperature: 0.4
    }), () => ({ text: facts.deleted.length ? `${facts.deleted.slice(0, 2).join(' and ')} confirmed deletion. ${facts.pending.length ? `${facts.pending.length} compan${facts.pending.length > 1 ? 'ies are' : 'y is'} still pending.` : 'Nothing is pending.'}` : rows.length ? `We're watching ${rows.length} companies that hold your data. Start by deleting the ones you no longer use.` : 'Run a scan to find out which companies hold your data.' }));
    summary = db.get('meta', 'summary-' + user.id)
      ? db.update('meta', 'summary-' + user.id, { day: today, version: targets.length + leaks.length, text: res.text, ai: res._ai })
      : db.insert('meta', { id: 'summary-' + user.id, day: today, version: targets.length + leaks.length, text: res.text, ai: res._ai });
  }
  const newThisMonth = db.filter('holdings', h => h.userId === user.id && daysBetween(h.createdAt, now()) <= 30).length;
  return {
    today: nowIso(),
    watching: { addresses: db.filter('addresses', a => a.userId === user.id && a.status === 'active').length, number: user.protectedNumber },
    leak: openLeak ? { id: openLeak.id, sender: openLeak.senderName, company: db.get('companies', openLeak.companyId)?.name, source: openLeak.investigation?.likelySourceName, at: openLeak.at } : null,
    kpis: {
      companies: rows.length, newThisMonth,
      beingDeleted: targets.filter(t => !isResolved(t)).length,
      progress: active ? describeRequest(active.id) : null,
      verified: targets.filter(isResolved).length,
      leaks: leaks.length
    },
    request: active ? describeRequest(active.id) : null,
    categories: Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })),
    score: privacyScore(user.id, rows),
    needs: needs.slice(0, 5),
    summary: { text: summary.text, ai: summary.ai }
  };
}
