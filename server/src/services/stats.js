// Public transparency board and regulator view, computed from receipts, requests, leaks and complaints.
import { db } from '../db.js';
import { config } from '../config.js';
import { generate, withFallback } from '../ai/gemini.js';
import { isResolved } from './requests.js';
import { publicCompany, companyByKey } from './companies.js';

// Illustrative baseline used only while real data is thin (marked "sample" in the UI).
const SAMPLE = {
  razorpay: { requests: 412, onTime: 99, avgDays: 2.1, leaks: 0 },
  myntra: { requests: 380, onTime: 96, avgDays: 3.4, leaks: 0 },
  zomato: { requests: 905, onTime: 97, avgDays: 4.2, leaks: 1 },
  flipkart: { requests: 1210, onTime: 82, avgDays: 11.8, leaks: 2 },
  makemytrip: { requests: 640, onTime: 64, avgDays: 19.5, leaks: 6 },
  swiggy: { requests: 870, onTime: 88, avgDays: 8.9, leaks: 3 },
  adnexa: { requests: 1530, onTime: 18, avgDays: null, leaks: 312 }
};

function grade(onTime, proof, leaks) {
  const score = (onTime ?? 50) * 0.6 + proof * 40 - Math.min(40, leaks * 4);
  return score >= 95 ? 'A+' : score >= 85 ? 'A' : score >= 72 ? 'B' : score >= 58 ? 'C' : score >= 45 ? 'D' : 'F';
}

export function companyScores() {
  if (config.demoMode) for (const k of Object.keys(SAMPLE)) companyByKey(k);
  const rows = [];
  for (const c of db.all('companies')) {
    const ts = db.filter('targets', t => t.companyId === c.id && t.sentAt);
    const leaks = db.filter('leaks', l => l.investigation?.likelySourceCompanyId === c.id).length;
    const done = ts.filter(isResolved);
    if (ts.length >= 3) {
      const onTime = Math.round(100 * done.filter(t => (new Date(t.resolvedAt) - new Date(t.sentAt)) / 86400000 <= 30).length / ts.length);
      const proof = done.length ? done.reduce((s, t) => s + (t.status === 'claimed' ? 0.6 : 1), 0) / done.length : 0;
      const avg = done.length ? Math.round(10 * done.reduce((s, t) => s + (new Date(t.resolvedAt) - new Date(t.sentAt)) / 86400000, 0) / done.length) / 10 : null;
      rows.push({ company: publicCompany(c), requests: ts.length, onTime, avgDays: avg, leaks, proof: done.some(t => t.status === 'verified') ? 'Silence-verified' : 'Signed email', grade: grade(onTime, proof, leaks), sample: false });
    } else if (config.demoMode && SAMPLE[c.key]) {
      const s = SAMPLE[c.key];
      const proof = c.key === 'flipkart' ? 0.6 : 0.8;
      rows.push({ company: publicCompany(c), requests: s.requests, onTime: s.onTime, avgDays: s.avgDays, leaks: s.leaks + leaks, proof: c.key === 'flipkart' ? 'Web form' : 'Signed email', grade: grade(s.onTime, proof, s.leaks + leaks), sample: true });
    }
  }
  const order = { 'A+': 0, A: 1, B: 2, C: 3, D: 4, F: 5 };
  rows.sort((a, b) => order[a.grade] - order[b.grade] || b.onTime - a.onTime);
  const realTargets = db.filter('targets', t => t.sentAt);
  const tracked = rows.reduce((s, r) => s + r.requests, 0);
  return {
    rows,
    totals: {
      requests: tracked,
      provenPct: realTargets.length ? Math.round(100 * realTargets.filter(t => t.receiptId).length / realTargets.length) : 61,
      ignoredPct: realTargets.length ? Math.round(100 * realTargets.filter(t => t.status === 'overdue').length / realTargets.length) : 9,
      leaks: db.all('leaks').length + (config.demoMode ? 1903 : 0)
    },
    includesSample: rows.some(r => r.sample)
  };
}

const pl = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

export async function regulatorView() {
  const complaints = db.filter('complaints', c => c.status === 'filed');
  const byParty = new Map();
  for (const c of complaints) for (const p of c.parties) byParty.set(p.name, (byParty.get(p.name) || 0) + 1);
  const leakSources = new Map();
  for (const l of db.all('leaks')) {
    const n = l.investigation?.likelySourceName;
    if (n) leakSources.set(n, { leaks: (leakSources.get(n)?.leaks || 0) + 1, senders: new Set([...(leakSources.get(n)?.senders || []), l.senderName]), apps: new Set([...(leakSources.get(n)?.apps || []), db.get('companies', l.companyId)?.name]) });
  }
  const ignored = new Map();
  for (const t of db.filter('targets', x => x.status === 'overdue')) { const n = db.get('companies', t.companyId)?.name; ignored.set(n, (ignored.get(n) || 0) + 1); }
  const offenders = [...new Set([...byParty.keys(), ...leakSources.keys(), ...ignored.keys()])].map(name => ({
    name, complaints: byParty.get(name) || 0, leaks: leakSources.get(name)?.leaks || 0, ignored: ignored.get(name) || 0
  })).sort((a, b) => (b.complaints + b.leaks + b.ignored) - (a.complaints + a.leaks + a.ignored));

  const top = offenders[0];
  const facts = top ? { name: top.name, complaints: top.complaints, leaks: top.leaks, ignored: top.ignored, apps: [...(leakSources.get(top.name)?.apps || [])], senders: [...(leakSources.get(top.name)?.senders || [])] } : null;
  const pattern = facts ? await withFallback('regulator-patterns', async () => generate({
    feature: 'regulator-patterns',
    system: 'You help a data protection regulator spot patterns across complaints. Only state what the numbers show. Recommend one action.',
    prompt: `Top offender data: ${JSON.stringify(facts)}. All offenders: ${JSON.stringify(offenders.slice(0, 8))}.
Return JSON {"headline":"max 14 words","explanation":"max 60 words","priority":"high|medium|low","action":"short button label"}`,
    json: true, temperature: 0.2
  }), () => ({
    headline: `${facts.name}: ${pl(facts.ignored, 'ignored deletion')} and ${pl(facts.leaks, 'traced leak')}`,
    explanation: `Complaints and leak investigations from users of ${facts.apps.length ? pl(facts.apps.length, 'app') : 'several apps'} point to the same company${facts.senders.length ? `, whose data reached ${facts.senders.join(', ')}` : ''}. This pattern suggests personal data is being passed on after deletion requests.`,
    priority: facts.leaks || facts.ignored ? 'high' : 'medium', action: 'Merge into one case'
  })) : null;

  return {
    kpis: { complaints: complaints.length, withEvidence: complaints.filter(c => c.packId).length, companies: byParty.size, leaks: db.all('leaks').length },
    complaints: complaints.map(c => ({ id: c.id, reference: c.reference, against: c.parties.map(p => p.name), issue: c.parties.map(p => p.issue).join('; '), evidence: (db.get('evidence', c.packId)?.items || []).length, filedAt: c.filedAt })).reverse(),
    offenders, pattern
  };
}
