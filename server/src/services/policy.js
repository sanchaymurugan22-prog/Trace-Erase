// AI policy reader: fetches a company's privacy policy and turns it into plain facts.
import { db } from '../db.js';
import { generate, withFallback } from '../ai/gemini.js';
import { nowIso } from './clock.js';

const htmlToText = (html) => html
  .replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<(br|p|div|li|h\d|tr)[^>]*>/gi, '\n').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"')
  .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();

async function fetchPolicyText(domain) {
  if (!domain || domain.endsWith('.example')) return null;
  const paths = ['/privacy', '/privacy-policy', '/privacypolicy', '/policies/privacy', '/legal/privacy', '/privacy.html'];
  for (const host of [`https://www.${domain}`, `https://${domain}`]) {
    for (const p of paths) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 8000);
        const r = await fetch(host + p, { signal: ctrl.signal, redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 TraceErase policy reader' } });
        clearTimeout(t);
        if (!r.ok) continue;
        const ct = r.headers.get('content-type') || '';
        if (!ct.includes('html') && !ct.includes('text')) continue;
        const text = htmlToText(await r.text());
        if (text.length > 1500 && /privacy|personal (data|information)/i.test(text)) return { url: r.url || host + p, text: text.slice(0, 60000) };
      } catch { /* try next */ }
    }
  }
  return null;
}

function contactEmails(text) {
  const all = [...new Set((text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || []).map(e => e.toLowerCase()))];
  const score = (e) => /grievance|privacy|dpo|dataprotection|data\.protection|legal|compliance/.test(e) ? 2 : /support|care|help/.test(e) ? 1 : 0;
  return all.sort((a, b) => score(b) - score(a)).slice(0, 4);
}

function ruleSummary(company) {
  const keeps = [];
  if (['Food', 'Shopping', 'Travel'].includes(company.category)) keeps.push({ what: 'Tax invoices', why: 'Tax law', until: 'About 8 years' });
  if (company.category === 'Finance') keeps.push({ what: 'Payment and KYC records', why: 'RBI and anti-money-laundering rules', until: 'About 5 to 10 years' });
  return {
    summary: `${company.name} is a ${company.category.toLowerCase()} service. These points are general for this kind of company; the full policy could not be read.`,
    deletesWithinDays: 30,
    keeps,
    sharesWith: (company.partnerTypes || []).map(t => ({ type: t, purpose: t.includes('Advert') ? 'Marketing' : 'Running the service' })),
    sellsData: 'unclear',
    deletionMethod: 'email',
    grievanceEmail: null,
    bullets: [
      { tone: 'good', text: 'Must delete your data when you ask, under the DPDP Act 2023' },
      ...keeps.map(k => ({ tone: 'warn', text: `Keeps ${k.what.toLowerCase()} because of ${k.why.toLowerCase()}` })),
      ...((company.partnerTypes || []).length ? [{ tone: 'warn', text: `Shares with ${company.partnerTypes.join(', ').toLowerCase()}` }] : [])
    ]
  };
}

/** The best privacy contact among the addresses found in the policy. */
function pickContact(emails) {
  const rank = (e) => /grievance|dpo|privacy|data.?protection/i.test(e) ? 0 : /legal|compliance|nodal/i.test(e) ? 1 : /support|care|help/i.test(e) ? 2 : 3;
  return [...emails].sort((a, b) => rank(a) - rank(b))[0];
}

export async function getPolicy(company, { refresh = false } = {}) {
  const cached = db.find('policies', p => p.companyId === company.id);
  if (cached && !refresh && (cached._ai || Date.now() - new Date(cached.updatedAt || cached.createdAt) < 3600e3)) return cached;

  const fetched = await fetchPolicyText(company.domains?.[0]);
  const emails = fetched ? contactEmails(fetched.text) : [];
  const result = await withFallback('policy-reader', async () => {
    const source = fetched ? `PRIVACY POLICY TEXT (from ${fetched.url}):\n${fetched.text.slice(0, 45000)}` : `No policy text could be downloaded. Use your general knowledge of ${company.name} (${company.domains?.[0] || 'unknown domain'}), and say so.`;
    const out = await generate({
      feature: 'policy-reader',
      system: 'You are a privacy-law analyst. You read privacy policies and explain them to ordinary people in short, plain sentences. Be accurate and never invent specifics that are not in the text. If something is not stated, say "not stated".',
      prompt: `Company: ${company.name} (category: ${company.category}).
${source}

Return JSON with exactly these keys:
{
 "summary": "2 sentences in plain English about what this company collects and does with it",
 "deletesWithinDays": number or null,
 "keeps": [{"what": "...", "why": "law or reason", "until": "how long"}],
 "sharesWith": [{"type": "kind of partner, e.g. payment processor", "purpose": "..."}],
 "sellsData": "no" | "yes" | "unclear",
 "deletionMethod": "email" | "webform" | "in-app" | "unknown",
 "grievanceEmail": "email address for privacy or grievance requests if stated, else null",
 "grievanceName": "name or title of grievance officer if stated, else null",
 "bullets": [{"tone": "good" | "warn" | "bad", "text": "max 12 words"}]   (4 to 6 bullets)
}`,
      json: true, temperature: 0.2
    });
    return { ...out, source: fetched ? 'policy' : 'knowledge' };
  }, () => ({ ...ruleSummary(company), source: 'rules' }));

  // Only trust an address that is really written in the company's policy (AI must not guess one)
  const said = String(result.grievanceEmail || '').trim().toLowerCase();
  if (said && !emails.map(e => e.toLowerCase()).includes(said)) { result.suggestedEmail = said; result.grievanceEmail = null; }
  if (!result.grievanceEmail && emails.length) result.grievanceEmail = pickContact(emails);
  const rec = { companyId: company.id, url: fetched?.url || null, contactEmails: emails, ...result, readAt: nowIso() };
  if (cached) return db.update('policies', cached.id, rec);
  return db.insert('policies', rec);
}
