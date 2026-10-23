// Discovery agent: finds every company that holds the user's data from inbox senders and Google sign-ins.
import { db } from '../db.js';
import { generate, withFallback } from '../ai/gemini.js';
import { findInCatalog, PERSONAL_DOMAINS, sampleInbox, sampleGoogleSignins } from './catalog.js';
import { getOrCreateCompany, upsertHolding, rootDomain, domainOf, publicCompany } from './companies.js';
import { fetchHeaders } from './gmail.js';
import { createAlert } from './notify.js';
import { nowIso } from './clock.js';

const NON_COMMERCIAL = /\.(ac|edu|gov|nic)(\.[a-z]{2})?$|\.edu$|\.gov$/;

function parseFrom(from) {
  const m = String(from).match(/^\s*"?([^"<]*)"?\s*<([^>]+)>/);
  return m ? { name: m[1].trim(), email: m[2].trim().toLowerCase() } : { name: '', email: String(from).trim().toLowerCase() };
}

function update(scanId, patch) { return db.update('scans', scanId, patch); }

export function startScan(user, { source = 'sample', messages = null, gmailToken = null, typed = false } = {}) {
  const scan = db.insert('scans', {
    userId: user.id, source, status: 'running', phase: 'Reading senders', progress: 2,
    sources: [
      { key: 'mail', label: source === 'gmail' ? 'Gmail senders' : typed ? 'Apps you listed' : source === 'upload' ? 'Uploaded email export' : 'Gmail (demo sample inbox)', state: 'running', detail: '' },
      { key: 'signins', label: 'Google sign-ins', state: 'waiting', detail: '' },
      { key: 'ai', label: 'AI identifying companies', state: 'waiting', detail: '' },
      { key: 'policies', label: 'Reading what each company keeps', state: 'waiting', detail: '' }
    ],
    found: 0, justFound: [], startedAt: nowIso()
  });
  runScan(user, scan.id, source, messages, gmailToken).catch(e => {
    console.error('[scan]', e);
    update(scan.id, { status: 'failed', error: e.message });
  });
  return scan;
}

const setSource = (scanId, key, patch) => {
  const s = db.get('scans', scanId);
  update(scanId, { sources: s.sources.map(x => x.key === key ? { ...x, ...patch } : x) });
};
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function runScan(user, scanId, source, uploaded, gmailToken) {
  // 1. Collect sender headers
  let headers;
  if (source === 'gmail') headers = await fetchHeaders(user, 500, (n, t) => setSource(scanId, 'mail', { detail: `${n} of ${t} emails checked` }), gmailToken);
  else if (source === 'upload') headers = (uploaded || []).filter(h => h && h.from);
  else headers = sampleInbox();
  setSource(scanId, 'mail', { state: 'done', detail: `${headers.length.toLocaleString('en-IN')} emails checked` });
  update(scanId, { progress: 20, phase: 'Grouping senders' });

  const byDomain = new Map();
  for (const h of headers) {
    const f = parseFrom(h.from);
    const d = rootDomain(domainOf(f.email));
    if (!d || PERSONAL_DOMAINS.includes(d) || NON_COMMERCIAL.test(d)) continue;
    const cur = byDomain.get(d) || { domain: d, names: new Set(), subjects: [], count: 0, lastSeen: null };
    cur.count++;
    if (f.name) cur.names.add(f.name);
    if (cur.subjects.length < 3 && h.subject) cur.subjects.push(h.subject.slice(0, 80));
    if (!cur.lastSeen || new Date(h.date) > new Date(cur.lastSeen)) cur.lastSeen = h.date;
    byDomain.set(d, cur);
  }

  // 2. Google sign-ins (sample when Gmail is not connected)
  setSource(scanId, 'signins', { state: 'running' });
  await sleep(500);
  // Sample Google sign-ins are demo data: only demo accounts get them
  const signins = user.demo && source === 'sample' ? sampleGoogleSignins() : [];
  setSource(scanId, 'signins', { state: 'done', detail: signins.length ? `${signins.length} apps listed` : 'Not included' });
  update(scanId, { progress: 35, phase: 'Identifying companies' });

  // 3. Known companies from the catalog; unknown domains go to AI
  setSource(scanId, 'ai', { state: 'running' });
  const known = [], unknown = [];
  for (const g of byDomain.values()) (findInCatalog(g.domain) ? known : unknown).push(g);

  let classified = [];
  if (unknown.length) {
    const res = await withFallback('discovery', async () => {
      const list = unknown.slice(0, 80).map(g => ({ domain: g.domain, senderNames: [...g.names].slice(0, 3), subjects: g.subjects }));
      const out = await generate({
        feature: 'discovery',
        system: 'You identify which companies hold a person\'s data from the email senders in their inbox. Only include real businesses or services the person likely has an account with. Exclude newsletters from people, universities, government and personal contacts.',
        prompt: `For each sender domain decide if it is a company holding this person's personal data.
Return JSON: {"companies":[{"domain":"...","name":"brand name","category":"Food|Shopping|Travel|Finance|Entertainment|Health|Jobs|Social|Education|Services|Other","isCompany":true|false,"dataTypes":["Email","Phone","Address","Payment","..."]}]}
Senders:
${JSON.stringify(list)}`,
        json: true, temperature: 0.1
      });
      return { list: out.companies || [] };
    }, () => ({
      list: unknown.map(g => ({ domain: g.domain, name: [...g.names][0]?.replace(/\s+(team|support|care|updates?|offers?)$/i, '') || g.domain.split('.')[0], category: 'Other', isCompany: true, dataTypes: ['Email'] }))
    }));
    classified = (res.list || []).filter(c => c.isCompany !== false);
    update(scanId, { aiUsed: res._ai });
  }
  setSource(scanId, 'ai', { state: 'done', detail: `${known.length + classified.length} companies identified` });
  update(scanId, { progress: 60, phase: 'Saving companies' });

  // 4. Save holdings, a few at a time so the progress screen shows them arriving
  const found = [];
  const add = (company, patch) => { upsertHolding(user.id, company, patch); found.push(company); };
  for (const g of known) {
    const c = getOrCreateCompany({ domain: g.domain });
    add(c, { sources: [source === 'gmail' ? 'gmail' : source], lastSeen: g.lastSeen, emailsSeen: g.count });
  }
  for (const k of classified) {
    const g = byDomain.get(rootDomain(k.domain)) || {};
    const c = getOrCreateCompany({ name: k.name, domain: k.domain, category: k.category, dataTypes: k.dataTypes });
    add(c, { sources: [source === 'gmail' ? 'gmail' : source], lastSeen: g.lastSeen, emailsSeen: g.count || 1 });
  }
  for (const s of signins) {
    const c = getOrCreateCompany({ name: s.app, domain: s.domain, category: 'Other' });
    add(c, { sources: ['google-signin'], lastSeen: s.lastUsed });
  }
  const uniq = [...new Map(found.map(c => [c.id, c])).values()];
  for (let i = 0; i < uniq.length; i += 4) {
    update(scanId, { found: Math.min(uniq.length, i + 4), justFound: uniq.slice(Math.max(0, i - 0), i + 4).map(c => ({ name: c.name, category: c.category, color: c.color })), progress: 60 + Math.round(30 * (i / uniq.length)) });
    await sleep(250);
  }
  setSource(scanId, 'policies', { state: 'done', detail: 'Ready on each company page' });

  // 5. AI summary
  const holdings = db.filter('holdings', h => h.userId === user.id);
  const summary = await summarize(user, holdings);
  update(scanId, { status: 'done', progress: 100, phase: 'Done', found: holdings.length, summary, finishedAt: nowIso() });
  db.update('users', user.id, { onboarding: { ...(user.onboarding || {}), scanned: true } });
  createAlert(user.id, { type: 'scan', title: `Scan complete: ${holdings.length} companies have your data`, body: summary.headline, link: '/app/companies' });
}

export async function summarize(user, holdings) {
  const rows = holdings.map(h => {
    const c = db.get('companies', h.companyId);
    const days = h.lastSeen ? Math.floor((Date.now() - new Date(h.lastSeen)) / 86400000) : null;
    return { name: c?.name, category: c?.category, partners: (c?.partnerTypes || []).length, daysSinceLastUse: days };
  });
  const unused = rows.filter(r => r.daysSinceLastUse !== null && r.daysSinceLastUse > 365).length;
  const sharing = rows.filter(r => r.partners > 0).length;
  const topSharers = [...rows].sort((a, b) => b.partners - a.partners).slice(0, 2).map(r => r.name);
  const res = await withFallback('scan-summary', async () => generate({
    feature: 'scan-summary',
    system: 'You are a friendly privacy coach. Write short, specific, calm sentences. No exaggeration.',
    prompt: `A person's data is held by these companies (with how many kinds of partners each shares with and days since last use):
${JSON.stringify(rows)}
Return JSON {"headline":"one sentence, max 30 words, mentioning the most useful fact and where to start","tips":["3 short actions"]}`,
    json: true, temperature: 0.4
  }), () => ({
    headline: `${unused ? `You haven't used ${unused} of these in over a year. ` : ''}${topSharers.filter(Boolean).join(' and ')} share${topSharers.length === 1 ? 's' : ''} your data with the most partners. Start with ${topSharers.length === 1 ? 'it' : 'those'}.`,
    tips: ['Delete accounts you no longer use', 'Switch old accounts to protected emails', 'Watch for leaks on your protected addresses']
  }));
  return { headline: res.headline, tips: res.tips || [], unused, sharing, total: rows.length, ai: res._ai };
}

export function scanStatus(scanId) {
  const s = db.get('scans', scanId);
  return s;
}
export const latestScan = (userId) => db.filter('scans', s => s.userId === userId).at(-1) || null;
export { publicCompany };
