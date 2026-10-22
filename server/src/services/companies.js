// Companies (global), holdings (which company holds which user's data) and protected addresses.
import { db } from '../db.js';
import { config } from '../config.js';
import { CATALOG, findInCatalog } from './catalog.js';
import { randomTag } from '../util/crypto.js';
import { nowIso } from './clock.js';

const COLORS = ['k1', 'k2', 'k3', 'k4', 'k5', 'k6', 'k7', 'k8', 'k9', 'k10'];
export const slug = (s) => String(s || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, '').slice(0, 14) || 'app';
export const domainOf = (s) => {
  const m = String(s || '').toLowerCase().match(/@([a-z0-9.-]+\.[a-z]{2,})/) || String(s || '').toLowerCase().match(/^(?:https?:\/\/)?(?:www\.)?([a-z0-9.-]+\.[a-z]{2,})/);
  return m ? m[1].replace(/^www\./, '') : '';
};
// Reduce mail.zomato.com -> zomato.com (keeps two-part TLDs like co.in)
export function rootDomain(d) {
  const parts = String(d || '').toLowerCase().split('.').filter(Boolean);
  if (parts.length <= 2) return parts.join('.');
  const twoPart = ['co.in', 'co.uk', 'com.au', 'org.in', 'net.in', 'ac.in', 'gov.in', 'co.jp'];
  const last2 = parts.slice(-2).join('.');
  return twoPart.includes(last2) ? parts.slice(-3).join('.') : last2;
}

export function getOrCreateCompany({ name, domain, category, dataTypes, partnerTypes }) {
  const d = rootDomain(domain);
  const cat = findInCatalog(d);
  let c = cat
    ? db.find('companies', x => x.key === cat.key)
    : db.find('companies', x => (d && x.domains?.includes(d)) || (!d && name && x.name.toLowerCase() === name.toLowerCase()));
  if (c) return c;
  if (cat) {
    return db.insert('companies', { key: cat.key, name: cat.name, domains: cat.domains, category: cat.category, color: cat.color, dataTypes: cat.dataTypes, partnerTypes: cat.partnerTypes, fictional: !!cat.fictional });
  }
  const color = COLORS[(name || d).split('').reduce((a, ch) => a + ch.charCodeAt(0), 0) % COLORS.length];
  return db.insert('companies', {
    key: slug(name || d) + '-' + randomTag(3), name: name || d, domains: d ? [d] : [], category: category || 'Other', color,
    dataTypes: dataTypes || ['Email'], partnerTypes: partnerTypes || [], fictional: false
  });
}

export const companyByKey = (key) => {
  let c = db.find('companies', x => x.key === key);
  if (!c) { const cat = CATALOG.find(x => x.key === key); if (cat) c = getOrCreateCompany({ name: cat.name, domain: cat.domains[0] }); }
  return c;
};

export function upsertHolding(userId, company, patch = {}) {
  let h = db.find('holdings', x => x.userId === userId && x.companyId === company.id);
  if (h) {
    const merged = { ...patch };
    if (patch.lastSeen && h.lastSeen && new Date(h.lastSeen) > new Date(patch.lastSeen)) delete merged.lastSeen;
    if (patch.sources) merged.sources = [...new Set([...(h.sources || []), ...patch.sources])];
    if (patch.emailsSeen) merged.emailsSeen = (h.emailsSeen || 0) + patch.emailsSeen;
    return db.update('holdings', h.id, merged);
  }
  return db.insert('holdings', {
    userId, companyId: company.id, sources: [], firstSeen: nowIso(), lastSeen: null, emailsSeen: 0,
    dataTypes: company.dataTypes || [], status: 'active', usingProtected: false, viaCompanyId: null, ...patch
  });
}

// ---------- protected addresses ----------
export function addressFor(userId, companyId) {
  return db.find('addresses', a => a.userId === userId && a.companyId === companyId && a.status === 'active');
}

/** purpose 'replies': made only so a company's answer to a deletion request reaches TraceErase. */
export function ensureAddress(userId, company, { purpose = null } = {}) {
  const existing = addressFor(userId, company.id);
  if (existing) {
    if (!purpose && existing.purpose === 'replies') return db.update('addresses', existing.id, { purpose: null });
    return existing;
  }
  let email;
  do { email = `${slug(company.name)}.${randomTag(4)}@${config.protectedDomain}`; } while (db.find('addresses', a => a.email === email));
  return db.insert('addresses', {
    userId, companyId: company.id, email, status: 'active', purpose,
    allowed: [...(company.domains || [])], blockedSenders: [], forwarded: 0, blocked: 0, leaks: 0
  });
}

export function rotateAddress(userId, addressId) {
  const a = db.get('addresses', addressId);
  if (!a || a.userId !== userId) return null;
  db.update('addresses', a.id, { status: 'rotated', rotatedAt: nowIso() });
  const company = db.get('companies', a.companyId);
  const fresh = ensureAddress(userId, company);
  db.update('addresses', fresh.id, { allowed: a.allowed, previous: a.email });
  return fresh;
}

export function allowSender(userId, addressId, domain) {
  const a = db.get('addresses', addressId);
  if (!a || a.userId !== userId) return null;
  if (!domain) return a;
  if (!a.allowed.includes(domain)) return db.update('addresses', a.id, { allowed: [...a.allowed, domain] });
  return a;
}

// Partners this company passed the user's data to (named in its own replies, recorded as receipts)
export function partnersOf(userId, companyId) {
  const shares = db.filter('receipts', r => r.kind === 'share' && r.userId === userId && r.companyId === companyId);
  const out = new Map();
  for (const s of shares) {
    const p = db.get('companies', s.data.partnerCompanyId);
    if (!p) continue;
    const prev = out.get(p.id);
    out.set(p.id, { company: p, receipts: [...(prev?.receipts || []), s] });
  }
  return [...out.values()];
}

export const publicCompany = (c) => c && ({
  id: c.id, key: c.key, name: c.name, domains: c.domains, domain: c.domains?.[0] || '', category: c.category, color: c.color,
  dataTypes: c.dataTypes, partnerTypes: c.partnerTypes, fictional: !!c.fictional
});
