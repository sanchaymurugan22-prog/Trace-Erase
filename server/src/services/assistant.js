// "Ask TraceErase": an AI assistant that answers from the user's own receipts, requests and alerts.
import { db } from '../db.js';
import { notFound } from '../http.js';
import { generate, withFallback, maskFor } from '../ai/gemini.js';
import { languageName } from './letters.js';
import { nowIso } from './clock.js';

function context(user) {
  const holdings = db.filter('holdings', h => h.userId === user.id);
  const companies = holdings.map(h => {
    const c = db.get('companies', h.companyId);
    const t = db.filter('targets', x => x.userId === user.id && x.companyId === c.id).at(-1);
    const pol = db.find('policies', p => p.companyId === c.id);
    return {
      id: c.id, name: c.name, category: c.category, status: t?.status || 'not asked', reference: t?.reference || null,
      kept: (t?.result?.kept || []).map(k => `${k.field} (${k.law})`), lastUsedDaysAgo: h.lastSeen ? Math.floor((Date.now() - new Date(h.lastSeen)) / 86400000) : null,
      sharesWith: (pol?.sharesWith || []).map(s => s.type).slice(0, 4), resolvedAt: t?.resolvedAt || null
    };
  });
  const shares = db.filter('receipts', r => r.userId === user.id && r.kind === 'share').map(r => ({ from: db.get('companies', r.companyId)?.name, to: db.get('companies', r.data.partnerCompanyId)?.name, fields: r.data.fields, on: r.issuedAt.slice(0, 10), receiptId: r.id }));
  const leaks = db.filter('leaks', l => l.userId === user.id).map(l => ({ id: l.id, sender: l.senderName, addressOf: db.get('companies', l.companyId)?.name, on: l.at.slice(0, 10), likelySource: l.investigation?.likelySourceName, confidence: l.investigation?.confidence }));
  const requests = db.filter('requests', r => r.userId === user.id && r.status !== 'draft').map(r => ({ id: r.id, number: r.number, status: r.status, signedOn: r.signedAt?.slice(0, 10) }));
  const complaints = db.filter('complaints', c => c.userId === user.id).map(c => ({ id: c.id, status: c.status, reference: c.reference, against: c.parties.map(p => p.name) }));
  return { companies, shares, leaks, requests, complaints, today: nowIso().slice(0, 10) };
}

function fallbackAnswer(user, q, ctx) {
  const text = q.toLowerCase();
  const c = ctx.companies.find(x => text.includes(x.name.toLowerCase().split(' ')[0]));
  if (/leak|who (gave|sold|shared)|how did .* get/.test(text) && ctx.leaks.length) {
    const l = ctx.leaks.at(-1);
    return { answer: `Most likely through ${l.likelySource || 'a partner'}. ${l.sender} emailed the address you gave only to ${l.addressOf}, and ${l.likelySource} received it from ${l.addressOf}, as ${l.addressOf} itself said in writing.`, links: [{ label: 'See the leak', to: `/app/leaks/${l.id}` }, ...(ctx.complaints[0] ? [{ label: 'Review complaint', to: `/app/complaints/${ctx.complaints[0].id}` }] : [])] };
  }
  if (c) {
    const st = { verified: 'deleted your data, and its address has stayed silent for 30 days since', partial: `deleted your data but kept ${c.kept.join(', ') || 'some records'} because the law requires it`, claimed: 'says it deleted your data in a signed email; we are watching its address for 30 days to verify', 'not asked': "hasn't been asked to delete your data yet" }[c.status] || `is at status "${c.status}"`;
    return { answer: `${c.name} ${st}.`, links: [{ label: `Open ${c.name}`, to: `/app/companies/${c.id}` }] };
  }
  if (/delete next|which apps|unused/.test(text)) {
    const old = ctx.companies.filter(x => (x.lastUsedDaysAgo || 0) > 365 && x.status === 'not asked').slice(0, 5);
    return { answer: old.length ? `Start with apps you haven't used in over a year: ${old.map(o => o.name).join(', ')}.` : 'You have already handled your unused apps.', links: [{ label: 'Delete my data', to: '/app/delete' }] };
  }
  if (/right|law|dpdp/.test(text)) return { answer: 'Under India\'s DPDP Act 2023 you can ask any company for a summary of your data (Section 11), ask it to correct or erase it (Section 12), raise a grievance (Section 13), and complain to the Data Protection Board if it ignores you. Companies must also tell their partners to delete your data.', links: [] };
  return { answer: `You have ${ctx.companies.length} companies holding your data, ${ctx.requests.length} deletion request(s) and ${ctx.leaks.length} leak(s). Ask me about a company, a leak or your rights.`, links: [{ label: 'Dashboard', to: '/app' }] };
}

export async function ask(user, { chatId, question, language }) {
  let chat = chatId ? db.get('chats', chatId) : null;
  if (chat && chat.userId !== user.id) throw notFound();
  if (!chat) chat = db.insert('chats', { userId: user.id, title: question.slice(0, 60), messages: [] });
  const ctx = context(user);
  const { mask, unmask } = maskFor(user);
  const history = chat.messages.slice(-8).map(m => ({ role: m.role === 'user' ? 'user' : 'model', text: mask(m.text) }));
  const res = await withFallback('assistant', async () => generate({
    feature: 'assistant',
    system: `You are TraceErase, a calm, precise privacy assistant. Answer ONLY from the JSON data about this person's companies, receipts, requests, leaks and complaints, plus general knowledge of India's DPDP Act 2023 and GDPR. If the data doesn't say, say you don't know yet. Keep answers under 90 words, plain language. Reply in ${languageName(language || user.language || 'en')}.
Status meanings: verified = the company confirmed deletion in a signed email AND its company-only address stayed silent for 30 days; partial = deleted except what a law requires it to keep; claimed = a signed email says deleted, the 30-day silence check is running; overdue = ignored the request, reminder and grievance.
Return JSON {"answer":"...","links":[{"label":"short","to":"app path"}]}. Valid paths: /app/companies/<company id>, /app/leaks/<leak id>, /app/requests/<request id>, /app/complaints/<complaint id>, /app/receipts/<receipt id>, /app/delete, /app.
DATA: ${mask(JSON.stringify(ctx))}`,
    prompt: [...history, { role: 'user', text: mask(question) }],
    json: true, temperature: 0.3, maxTokens: 700
  }), () => fallbackAnswer(user, question, ctx));
  const msgUser = { role: 'user', text: question, at: nowIso() };
  const msgAi = { role: 'assistant', text: unmask(res.answer || ''), links: (res.links || []).filter(l => typeof l.to === 'string' && l.to.startsWith('/app')).slice(0, 3), ai: res._ai, at: nowIso() };
  db.update('chats', chat.id, c => ({ messages: [...c.messages, msgUser, msgAi] }));
  return { chatId: chat.id, message: msgAi };
}

export const listChats = (userId) => db.filter('chats', c => c.userId === userId).map(c => ({ id: c.id, title: c.title, at: c.updatedAt || c.createdAt, count: c.messages.length })).reverse();
export function getChat(user, id) {
  const c = db.get('chats', id);
  if (!c || c.userId !== user.id) throw notFound();
  return c;
}
