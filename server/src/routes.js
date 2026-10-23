// All API routes.
import crypto from 'node:crypto';
import { parseEmail } from './util/mime.js';
import { config, devMailOnly, reloadConfig, ENV_FILE, usesProtectedEmail } from './config.js';
import { updateEnvFile } from './util/env.js';
import * as staff from './services/staff.js';
import { db, storageStatus } from './db.js';
import { bad, notFound, forbidden } from './http.js';
import { aiStatus, generate, resetAi, mainModelCandidates } from './ai/gemini.js';
import * as auth from './services/auth.js';
import * as wa from './services/webauthn.js';
import * as discovery from './services/discovery.js';
import * as gmail from './services/gmail.js';
import * as views from './services/views.js';
import * as reqs from './services/requests.js';
import * as evidence from './services/evidence.js';
import * as complaints from './services/complaints.js';
import * as inbound from './services/inbound.js';
import * as assistant from './services/assistant.js';
import * as stats from './services/stats.js';
import * as demo from './services/demo.js';
import * as docs from './services/docs.js';
import { translate } from './services/i18n.js';
import { getPolicy } from './services/policy.js';
import { verifyReceipt, addReceipt, publicReceipt, runBatch } from './services/ledger.js';
import { escalate } from './services/requests.js';
import { getOrCreateCompany, upsertHolding, ensureAddress, rotateAddress, allowSender, publicCompany, addressFor, domainOf, rootDomain } from './services/companies.js';
import { findInCatalog } from './services/catalog.js';
import { draftLetter } from './services/letters.js';
import { sendEmail } from './services/notify.js';
import { offsetDays, nowIso, resetClock } from './services/clock.js';

const U = (req) => auth.requireVerified(req);
const needInbox = (req) => { if (!usesProtectedEmail(req.user)) throw bad('Protected email addresses are not available yet: they need an email domain, which this free setup does not have. You can try them in the demo.'); };

export function registerRoutes(app) {
  // ---------- session & profile ----------
  app.get('/api/me', (req) => {
    const u = auth.currentUser(req);
    return {
      user: auth.publicUser(u), staff: staff.publicStaff(staff.currentStaff(req)), ai: aiStatus(),
      flags: { gmailConfigured: gmail.gmailConfigured(), gmailRedirectUri: config.google.redirectUri, devMail: devMailOnly, devSms: !config.twilio.sid, demoMode: config.demoMode, protectedDomain: config.protectedDomain, clockOffsetDays: offsetDays(), sendRealRequests: config.sendRequestsForReal, chain: !!config.chain.rpcUrl, firebaseAuth: !!(config.firebase.projectId || process.env.FIREBASE_SERVICE_ACCOUNT), smsAvailable: !!config.twilio.sid, isDemo: !!u?.demo, protectedEmail: usesProtectedEmail(u) }
    };
  });
  app.patch('/api/me', (req) => {
    auth.requireUser(req);
    const { name, language, settings, onboarding, letterLanguage } = req.body;
    const patch = {};
    if (name) patch.name = String(name).slice(0, 80);
    if (language) patch.language = language;
    if (letterLanguage) patch.letterLanguage = letterLanguage;
    if (req.body.phone !== undefined) {
      const ph = auth.normPhone(req.body.phone);
      if (ph && ph.replace(/\D/g, '').length < 10) throw bad('Please enter a valid mobile number');
      patch.phone = ph;
    }
    if (settings) patch.settings = { ...auth.DEFAULT_SETTINGS, ...(req.user.settings || {}), ...settings };
    if (onboarding) patch.onboarding = { ...(req.user.onboarding || {}), ...onboarding };
    return { user: auth.publicUser(db.update('users', req.user.id, patch)) };
  });
  app.get('/api/me/export', (req, res) => {
    U(req);
    const id = req.user.id;
    const dump = {};
    for (const c of ['holdings', 'addresses', 'requests', 'targets', 'receipts', 'messages', 'alerts', 'leaks', 'evidence', 'complaints', 'certificates', 'chats']) dump[c] = db.filter(c, r => r.userId === id);
    res.setHeader('Content-Disposition', 'attachment; filename="traceerase-export.json"');
    res.json({ exportedAt: nowIso(), user: auth.publicUser(req.user), ...dump });
  });
  app.delete('/api/me', (req, res) => {
    U(req);
    const id = req.user.id;
    const receipt = addReceipt({ userId: null, kind: 'deletion', title: 'TraceErase deleted an account', data: { account: id.slice(0, 6) + '…', deleted: ['profile', 'protected addresses', 'requests', 'messages', 'chats'], kept: [{ field: 'Anonymous receipt fingerprints', law: 'Needed to keep the public ledger verifiable' }] }, signedBy: 'TraceErase' });
    for (const c of ['holdings', 'addresses', 'requests', 'targets', 'messages', 'alerts', 'leaks', 'evidence', 'complaints', 'certificates', 'chats', 'passkeys', 'otps', 'outbox']) db.remove(c, r => r.userId === id);
    db.remove('users', u => u.id === id);
    auth.endSession(res);
    return { ok: true, receiptId: receipt.id };
  });

  // ---------- sign up / log in ----------
  app.post('/api/auth/signup', (req) => auth.signup(req.body));
  app.post('/api/auth/resend', (req) => auth.resendCodes(req.body));
  app.post('/api/auth/verify', (req, res) => {
    const user = auth.verifySignup(req.body);
    const token = auth.startSession(res, user);
    return { user: auth.publicUser(user), token };
  });
  app.post('/api/auth/login/code', (req) => auth.requestLoginCode(req.body));
  app.post('/api/auth/login/verify', (req, res) => {
    const user = auth.verifyLogin(req.body);
    const token = auth.startSession(res, user);
    return { user: auth.publicUser(user), token };
  });
  app.post('/api/auth/logout', (req, res) => { auth.endSession(res); return { ok: true }; });
  // Firebase Authentication (email + password, or Google): the website signs in with Firebase and sends us the ID token
  app.post('/api/auth/firebase', async (req, res) => {
    const user = await auth.firebaseLogin(req.body);
    const token = auth.startSession(res, user);
    return { user: auth.publicUser(user), token };
  });
  // Try the demo: a separate demo account with sample data and demo controls (never touches real data)
  app.post('/api/demo/start', (req, res) => {
    if (!config.demoMode) throw forbidden('The demo is switched off on this server');
    const user = auth.createDemoUser(req.body);
    const token = auth.startSession(res, user);
    return { user: auth.publicUser(user), token };
  });

  // ---------- regulator (staff) accounts ----------
  app.post('/api/auth/staff/login', (req, res) => staff.login(res, req.body));
  app.post('/api/auth/staff/logout', (req, res) => { staff.logout(res); return { ok: true }; });
  app.get('/api/regulator/overview', (req) => { staff.requireRegulator(req); return stats.regulatorView(); });
  app.post('/api/auth/passkey/register/options', (req) => { auth.requireUser(req); return wa.registrationOptions(req.user); });
  app.post('/api/auth/passkey/register/verify', (req) => {
    auth.requireUser(req);
    const pk = wa.verifyRegistration(req.user, req.body.credential, req.body.label);
    return { ok: true, passkey: { id: pk.id, label: pk.label, createdAt: pk.createdAt } };
  });
  app.post('/api/auth/passkey/login/options', () => wa.authenticationOptions({ purpose: 'login' }));
  app.post('/api/auth/passkey/login/verify', (req, res) => {
    const r = wa.verifyAssertion(req.body.credential, 'login');
    const user = db.get('users', r.passkey.userId);
    const token = auth.startSession(res, user);
    return { user: auth.publicUser(user), token };
  });
  app.get('/api/passkeys', (req) => { U(req); return db.filter('passkeys', p => p.userId === req.user.id).map(p => ({ id: p.id, label: p.label, createdAt: p.createdAt, lastUsed: p.lastUsed })); });
  app.delete('/api/passkeys/:id', (req) => { U(req); db.remove('passkeys', p => p.id === req.params.id && p.userId === req.user.id); return { ok: true }; });

  // ---------- protected identity ----------
  app.get('/api/identity', (req) => {
    U(req);
    const addrs = db.filter('addresses', a => a.userId === req.user.id).map(a => ({ ...a, company: publicCompany(db.get('companies', a.companyId)) })).reverse();
    return { protectedNumber: auth.shownNumber(req.user), addresses: addrs };
  });
  app.post('/api/identity/protect', async (req) => {
    U(req);
    const input = String(req.body.app || '').trim();
    if (!input) throw bad('Type an app name or website');
    let domain = rootDomain(domainOf(input));
    let name = input;
    const cat = findInCatalog(domain) || (!domain && db.find('companies', c => c.name.toLowerCase() === input.toLowerCase()));
    if (cat?.domains) domain = cat.domains[0];
    if (!domain && !cat) domain = input.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';
    if (domain && !cat) name = domain.split('.')[0].replace(/^./, s => s.toUpperCase());
    const company = getOrCreateCompany({ name: cat?.name || name, domain });
    needInbox(req);
    upsertHolding(req.user.id, company, { sources: ['manual'], usingProtected: true, lastSeen: nowIso() });
    const address = ensureAddress(req.user.id, company);
    const policy = await getPolicy(company).catch(() => null);
    return { company: publicCompany(company), address, protectedNumber: auth.shownNumber(req.user), policy };
  });
  app.post('/api/identity/addresses/:id/rotate', (req) => { U(req); needInbox(req); const a = rotateAddress(req.user.id, req.params.id); if (!a) throw notFound(); return a; });
  // Take a sender off an address's allowed or blocked list
  app.post('/api/identity/addresses/:id/senders/remove', (req) => {
    U(req);
    const a = db.get('addresses', req.params.id);
    if (!a || a.userId !== req.user.id) throw notFound();
    const d = String(req.body.domain || '');
    const list = req.body.list === 'blocked' ? 'blockedSenders' : 'allowed';
    return db.update('addresses', a.id, { [list]: (a[list] || []).filter(x => x !== d) });
  });
  app.post('/api/identity/addresses/:id/allow', (req) => {
    U(req);
    const domain = rootDomain(domainOf(req.body.domain) || String(req.body.domain || '').trim().toLowerCase());
    if (!domain || !domain.includes('.')) throw bad('Enter a website or email domain, for example swiggy.com');
    const a = allowSender(req.user.id, req.params.id, domain); if (!a) throw notFound(); return a;
  });

  // ---------- discovery ----------
  app.post('/api/scan', (req) => {
    U(req);
    const source = req.body.source || (req.user.demo ? 'sample' : 'gmail');
    if (!['sample', 'gmail', 'upload'].includes(source)) throw bad('Unknown scan source');
    // The sample inbox is pretend data, so only demo accounts may use it
    if (source === 'sample' && !req.user.demo) throw bad('The sample inbox is only for demo accounts. Scan your Gmail or upload a list instead.');
    const gmailToken = typeof req.body.accessToken === 'string' && /^[\w.\-~+/=]{20,4096}$/.test(req.body.accessToken) ? req.body.accessToken : null;
    if (source === 'gmail' && !gmailToken && !req.user.gmail?.refreshToken) throw bad('Connect Gmail first');
    if (source === 'gmail' && req.user.demo) throw bad('Demo accounts use the sample inbox. Sign up to scan your own Gmail.');
    return discovery.startScan(req.user, { source, messages: req.body.messages, gmailToken });
  });
  app.get('/api/scan/latest', (req) => { U(req); return discovery.latestScan(req.user.id); });
  app.get('/api/scan/:id', (req) => { U(req); const s = db.get('scans', req.params.id); if (!s || s.userId !== req.user.id) throw notFound(); return s; });
  app.get('/api/gmail/auth-url', (req) => { U(req); if (!gmail.gmailConfigured()) throw bad('Gmail is not set up on this server (add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to server/.env)'); return { url: gmail.authUrl(req.user.id) }; });
  app.get('/api/gmail/callback', async (req, res) => {
    try { await gmail.handleCallback(req.query); res.redirect(`${config.appUrl}/onboarding/connect?gmail=connected`); }
    catch (e) { res.redirect(`${config.appUrl}/onboarding/connect?gmail=error&reason=${encodeURIComponent(e.message)}`); }
  });

  // ---------- companies, map, dashboard ----------
  app.get('/api/dashboard', (req) => { U(req); return views.dashboard(req.user); });
  app.get('/api/companies', (req) => { U(req); return views.companiesList(req.user.id); });
  app.get('/api/companies/:id', (req) => { U(req); return views.companyDetail(req.user, req.params.id); });
  app.post('/api/companies/:id/policy/refresh', async (req) => { U(req); const c = db.get('companies', req.params.id); if (!c) throw notFound(); return getPolicy(c, { refresh: true }); });
  app.get('/api/map', (req) => { U(req); return views.dataMap(req.user.id); });

  // Fix an old account: 1 switch email, 2 ask what they hold, 3 check reply, 4 decide
  app.post('/api/companies/:id/fix', async (req) => {
    U(req);
    const c = db.get('companies', req.params.id);
    const h = db.find('holdings', x => x.userId === req.user.id && x.companyId === req.params.id);
    if (!c || !h) throw notFound();
    const fix = { step: 1, ...(h.fix || {}) };
    needInbox(req);
    const address = ensureAddress(req.user.id, c);
    const action = req.body.action;
    if (action === 'switched') { fix.step = Math.max(fix.step, 2); fix.switchedAt = nowIso(); db.update('holdings', h.id, { usingProtected: true }); }
    if (action === 'draft-access') {
      const letter = await draftLetter(req.user, { kind: 'access', companyName: c.name, protectedEmail: address.email, language: req.body.language || 'en' });
      const policy = await getPolicy(c).catch(() => null);
      fix.letter = { ...letter, to: policy?.grievanceEmail || `privacy@${c.domains?.[0]}`, guessed: !policy?.grievanceEmail };
    }
    if (action === 'send-access') {
      const l = req.body.letter || fix.letter;
      if (!l) throw bad('Draft the request first');
      const out = await sendEmail({ userId: req.user.id, to: l.to, from: reqs.fromLine(req.user, address.email), subject: l.subject, text: l.body, kind: 'access-request', deliver: reqs.sendsForReal(req.user, c), holdNote: 'Ready to send (real sending is off).' });
      addReceipt({ userId: req.user.id, companyId: c.id, kind: 'message', title: `Data access request to ${c.name}`, data: { subject: l.subject, sentAt: nowIso() }, signedBy: 'User account' });
      fix.step = Math.max(fix.step, 3); fix.sentAt = nowIso(); fix.outboxId = out.id; fix.letter = l;
    }
    if (action === 'decide') { fix.step = 4; fix.decision = req.body.decision; }
    db.update('holdings', h.id, { fix });
    return { fix, address };
  });

  // ---------- deletion requests ----------
  app.post('/api/requests/draft', (req) => { U(req); return reqs.createDraft(req.user, req.body.companyIds); });
  app.get('/api/requests', (req) => { U(req); return reqs.listRequests(req.user.id); });
  app.get('/api/requests/:id', (req) => { U(req); const r = reqs.describeRequest(req.params.id); if (!r || r.userId !== req.user.id) throw notFound(); return r; });
  app.get('/api/targets/:id', (req) => {
    U(req);
    const t = reqs.describeTarget(req.params.id);
    if (!t || t.userId !== req.user.id) throw notFound();
    const req2 = db.get('requests', t.requestId);
    const outbox = t.outboxId ? db.get('outbox', t.outboxId) : null;
    return { ...t, request: { id: req2.id, number: req2.number }, outbox, receipt: t.receiptId ? publicReceipt(db.get('receipts', t.receiptId)) : null };
  });
  app.post('/api/requests/:id/sign/options', (req) => {
    U(req);
    const r = db.get('requests', req.params.id);
    if (!r || r.userId !== req.user.id) throw notFound();
    const hasPasskey = db.filter('passkeys', p => p.userId === req.user.id).length > 0;
    return { hasPasskey, payloadHash: r.payloadHash, options: hasPasskey ? wa.authenticationOptions({ userId: req.user.id, purpose: 'sign-request', payloadHash: r.payloadHash }) : null };
  });
  app.post('/api/requests/:id/sign', async (req) => {
    U(req);
    const r = db.get('requests', req.params.id);
    if (!r || r.userId !== req.user.id) throw notFound();
    let signature = null;
    if (req.body.credential) {
      const v = wa.verifyAssertion(req.body.credential, 'sign-request');
      if (v.passkey.userId !== req.user.id) throw forbidden();
      if (v.challenge.payloadHash !== r.payloadHash) throw bad('The signed request does not match');
      signature = v.signature;
    } else if (db.filter('passkeys', p => p.userId === req.user.id).length) throw bad('Please confirm with your passkey');
    return reqs.activate(req.user, r.id, { signature, autoOtp: req.body.autoOtp !== false, autoEscalate: req.body.autoEscalate !== false });
  });
  app.delete('/api/requests/:id', (req) => {
    U(req);
    const r = db.get('requests', req.params.id);
    if (!r || r.userId !== req.user.id || r.status !== 'draft') throw bad('Only drafts can be removed');
    db.remove('targets', t => t.requestId === r.id); db.remove('requests', x => x.id === r.id);
    return { ok: true };
  });
  app.post('/api/targets/:id/mark-sent', (req) => { U(req); return reqs.markSentManually(req.user, req.params.id); });
  app.post('/api/targets/:id/reply', (req) => { U(req); return reqs.pasteReply(req.user, req.params.id, req.body || {}); });
  app.post('/api/targets/:id/send', (req) => { U(req); return reqs.sendHeldLetter(req.user, req.params.id, req.body.to); });
  app.post('/api/targets/:id/webform-done', (req) => { U(req); return reqs.markWebformSubmitted(req.user, req.params.id, req.body.reference); });
  app.post('/api/requests/:id/certificate', (req) => { U(req); return reqs.issueCertificate(req.user, req.params.id); });
  app.get('/api/certificates/:id', (req) => { U(req); const c = db.get('certificates', req.params.id); if (!c || c.userId !== req.user.id) throw notFound(); return { ...c, receipt: publicReceipt(db.get('receipts', c.receiptId)), request: db.get('requests', c.requestId)?.number }; });

  // ---------- alerts, leaks, evidence, complaints ----------
  app.get('/api/alerts', (req) => { U(req); return db.filter('alerts', a => a.userId === req.user.id).reverse(); });
  app.post('/api/alerts/read-all', (req) => { U(req); for (const a of db.filter('alerts', a => a.userId === req.user.id && !a.read)) db.update('alerts', a.id, { read: true }); return { ok: true }; });
  app.post('/api/alerts/:id/read', (req) => { U(req); const a = db.get('alerts', req.params.id); if (!a || a.userId !== req.user.id) throw notFound(); db.update('alerts', a.id, { read: true }); return { ok: true }; });
  app.get('/api/leaks', (req) => { U(req); return db.filter('leaks', l => l.userId === req.user.id).reverse(); });
  app.get('/api/leaks/:id', (req) => {
    U(req);
    const l = db.get('leaks', req.params.id);
    if (!l || l.userId !== req.user.id) throw notFound();
    const addr = db.get('addresses', l.addressId);
    return { ...l, company: publicCompany(db.get('companies', l.companyId)), address: addr, current: addressFor(req.user.id, l.companyId), packId: db.filter('evidence', e => e.leakId === l.id).at(-1)?.id || null, complaintId: db.filter('complaints', c => db.get('evidence', c.packId)?.leakId === l.id).at(-1)?.id || null };
  });
  app.post('/api/leaks/:id/actions', async (req) => {
    U(req);
    const l = db.get('leaks', req.params.id);
    if (!l || l.userId !== req.user.id) throw notFound();
    const a = req.body.action;
    if (a === 'rotate') { const fresh = rotateAddress(req.user.id, l.addressId) || addressFor(req.user.id, l.companyId); db.update('leaks', l.id, { actions: { ...l.actions, rotated: true, newAddress: fresh?.email } }); return { ok: true, address: fresh }; }
    if (a === 'reinvestigate') return inbound.investigate(req.user, l.id);
    if (a === 'evidence') { const p = await evidence.buildPack(req.user, { leakId: l.id }); db.update('leaks', l.id, { actions: { ...l.actions, evidence: p.id } }); return p; }
    if (a === 'complaint') {
      const p = db.filter('evidence', e => e.leakId === l.id).at(-1) || await evidence.buildPack(req.user, { leakId: l.id });
      return complaints.draftComplaint(req.user, { packId: p.id });
    }
    if (a === 'request-deletion') {
      const company = db.get('companies', l.senderCompanyId) || getOrCreateCompany({ name: l.senderName, domain: l.senderDomain });
      upsertHolding(req.user.id, company, { sources: ['leak'] });
      const draft = await reqs.createDraft(req.user, [company.id]);
      db.update('leaks', l.id, { actions: { ...l.actions, deletionRequested: true, requestId: draft.id } });
      return draft;
    }
    if (a === 'resolve') { db.update('leaks', l.id, { status: 'resolved' }); return { ok: true }; }
    throw bad('Unknown action');
  });
  app.get('/api/evidence', (req) => { U(req); return db.filter('evidence', e => e.userId === req.user.id).reverse(); });
  app.post('/api/evidence', (req) => { U(req); return evidence.buildPack(req.user, req.body); });
  app.get('/api/evidence/:id', (req) => { U(req); return evidence.getPack(req.user, req.params.id); });
  app.get('/api/complaints', (req) => { U(req); return db.filter('complaints', c => c.userId === req.user.id).reverse(); });
  app.post('/api/complaints', (req) => { U(req); return complaints.draftComplaint(req.user, req.body); });
  app.get('/api/complaints/:id', (req) => {
    U(req);
    const c = db.get('complaints', req.params.id);
    if (!c || c.userId !== req.user.id) throw notFound();
    return { ...c, pack: db.get('evidence', c.packId) };
  });
  app.patch('/api/complaints/:id', (req) => {
    U(req);
    const c = db.get('complaints', req.params.id);
    if (!c || c.userId !== req.user.id || c.status !== 'draft') throw bad('Only drafts can be edited');
    return db.update('complaints', c.id, { summary: req.body.summary ?? c.summary, asks: req.body.asks ?? c.asks });
  });
  app.post('/api/complaints/:id/file', (req) => { U(req); return complaints.fileComplaint(req.user, req.params.id, req.body); });

  // ---------- receipts & verification ----------
  app.get('/api/receipts', (req) => { U(req); return db.filter('receipts', r => r.userId === req.user.id).map(r => ({ ...publicReceipt(r), company: r.companyId ? db.get('companies', r.companyId)?.name : null })).reverse(); });
  app.get('/api/receipts/:id', (req) => {
    U(req);
    const r = db.get('receipts', req.params.id);
    if (!r || r.userId !== req.user.id) throw notFound();
    // A deletion request this receipt can back up as evidence (for a disclosure: the partner that received the data)
    const subject = r.data?.partnerCompanyId || r.companyId;
    const evidenceTargetId = subject ? db.filter('targets', x => x.userId === req.user.id && x.companyId === subject).at(-1)?.id || null : null;
    return { ...r, company: publicCompany(db.get('companies', r.companyId)), partner: r.data?.partnerCompanyId ? publicCompany(db.get('companies', r.data.partnerCompanyId)) : null, verification: verifyReceipt(r.id), evidenceTargetId };
  });
  app.get('/api/verify/:id', (req) => verifyReceipt(req.params.id));

  // ---------- activity, outbox ----------
  app.get('/api/activity', (req) => {
    U(req);
    const all = db.filter('messages', m => m.userId === req.user.id).reverse();
    const weekAgo = Date.now() - 7 * 86400000;
    return {
      items: all.slice(0, 300),
      counts: { forwarded: all.filter(m => ['forwarded', 'rang'].includes(m.action) && new Date(m.at) > weekAgo).length, blocked: all.filter(m => m.action === 'blocked').length, codes: all.filter(m => m.action === 'code').length, leaks: all.filter(m => m.leakId).length }
    };
  });
  app.get('/api/outbox', (req) => { U(req); return db.filter('outbox', o => o.userId === req.user.id).reverse().slice(0, 100); });

  // ---------- AI ----------
  app.get('/api/ai/status', () => aiStatus());
  // Re-read server/.env and try Gemini again (after the key was fixed)
  app.post('/api/ai/retry', async (req) => {
    U(req);
    reloadConfig(); resetAi();
    const t0 = Date.now();
    try { const text = await generate({ feature: 'ai-test', prompt: 'Reply with exactly: TraceErase AI is working', temperature: 0, models: mainModelCandidates() }); return { ok: true, text, ms: Date.now() - t0, ...aiStatus() }; }
    catch (e) { return { ok: false, error: e.message, ...aiStatus() }; }
  });

  // ---------- local setup (only from this computer) ----------
  const localOnly = (req) => {
    const ip = String(req.socket?.remoteAddress || '');
    if (!/^(::1|127\.0\.0\.1|::ffff:127\.0\.0\.1)$/.test(ip)) throw forbidden('Setup can only be changed from the computer running TraceErase');
  };
  app.get('/api/setup/status', (req) => {
    U(req);
    return { gmail: { configured: gmail.gmailConfigured(), redirectUri: config.google.redirectUri, clientId: config.google.clientId ? config.google.clientId.slice(0, 12) + '…' : null }, ai: aiStatus(), keyHint: config.geminiKey ? `${config.geminiKey.slice(0, 4)}…${config.geminiKey.slice(-4)}` : null };
  });
  app.post('/api/setup/gmail', (req) => {
    U(req); localOnly(req);
    const clientId = String(req.body.clientId || '').trim(), clientSecret = String(req.body.clientSecret || '').trim();
    if (!/\.apps\.googleusercontent\.com$/.test(clientId)) throw bad('The Client ID should end with .apps.googleusercontent.com');
    if (clientSecret.length < 10) throw bad('Paste the Client secret too');
    updateEnvFile(ENV_FILE, { GOOGLE_CLIENT_ID: clientId, GOOGLE_CLIENT_SECRET: clientSecret });
    reloadConfig();
    return { configured: gmail.gmailConfigured() };
  });
  app.post('/api/setup/gemini', async (req) => {
    U(req); localOnly(req);
    const key = String(req.body.key || '').trim();
    if (key.length < 20) throw bad('That does not look like an API key');
    updateEnvFile(ENV_FILE, { GEMINI_API_KEY: key });
    reloadConfig(); resetAi();
    try { await generate({ feature: 'ai-test', prompt: 'Reply with exactly: ok', temperature: 0, models: mainModelCandidates() }); }
    catch {}
    const st = aiStatus();
    if (st.model) updateEnvFile(ENV_FILE, { GEMINI_PROVIDER: st.provider, GEMINI_MODEL: st.model });
    return st;
  });
  app.post('/api/ai/test', async (req) => {
    U(req);
    const t0 = Date.now();
    try {
      const text = await generate({ feature: 'ai-test', prompt: 'Reply with exactly: TraceErase AI is working', temperature: 0 });
      return { ok: true, text, ms: Date.now() - t0, ...aiStatus() };
    } catch (e) { return { ok: false, error: e.message, ...aiStatus() }; }
  });
  app.get('/api/assistant/chats', (req) => { U(req); return assistant.listChats(req.user.id); });
  app.get('/api/assistant/chats/:id', (req) => { U(req); return assistant.getChat(req.user, req.params.id); });
  app.post('/api/assistant', (req) => {
    U(req);
    const q = String(req.body.question || '').trim();
    if (!q) throw bad('Ask a question');
    return assistant.ask(req.user, { chatId: req.body.chatId, question: q.slice(0, 1000), language: req.body.language });
  });
  app.post('/api/i18n', (req) => translate(req.body.lang, (req.body.strings || []).slice(0, 400)));
  app.get('/api/policy/:companyId', async (req) => { U(req); const c = db.get('companies', req.params.companyId); if (!c) throw notFound(); return getPolicy(c); });

  // ---------- inbound webhooks (real providers or demo) ----------
  const isLocal = (req) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress) && !req.headers['x-forwarded-for'];
  const sameSecret = (a, b) => { const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || '')); return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y); };
  const inboundGuard = (req) => {
    const secret = config.inboundSecret || process.env.INBOUND_SECRET;
    if (!secret) { if (isLocal(req)) return; throw forbidden('Set INBOUND_SECRET on the server to receive email'); }
    if (!sameSecret(req.headers['x-inbound-secret'], secret)) throw forbidden('Bad inbound secret');
  };
  // Cloudflare Email Worker posts each email as it arrived (raw MIME); envelope addresses come as headers
  app.post('/api/inbound/raw', async (req) => {
    inboundGuard(req);
    const mail = parseEmail(req.rawBody || Buffer.alloc(0));
    const to = String(req.headers['x-envelope-to'] || mail.to).toLowerCase().match(/[^\s<>"]+@[^\s<>",]+/)?.[0] || '';
    const known = db.find('addresses', a => a.email === to);
    if (!known) return { action: 'unknown-address', to };
    const text = mail.text + (mail.attachments.length ? `\n\n[Attachments: ${mail.attachments.join(', ')}]` : '');
    return inbound.processEmail({ to, from: mail.from || req.headers['x-envelope-from'], subject: mail.subject, text: text.slice(0, 20000), dkim: mail.dkim || req.headers['x-dkim'] || undefined });
  });
  // Health check (the keep-awake ping) and the scheduled job runner
  app.get('/api/health', () => ({ ok: true, storage: storageStatus.storage, lastSaveAt: storageStatus.lastSaveAt, saveError: storageStatus.lastError ? true : false, time: new Date().toISOString() }));
  app.post('/api/cron/tick', async (req) => {
    const secret = config.cronSecret;
    if (!secret ? !isLocal(req) : !sameSecret(req.headers['x-cron-secret'] || req.headers.authorization?.replace(/^Bearer /, ''), secret)) throw forbidden('Bad cron secret');
    const { cleanupDemoAccounts } = await import('./services/demo.js');
    const removed = config.demoMode ? cleanupDemoAccounts() : 0;
    await escalate();
    await runBatch().catch(() => {});
    return { ok: true, demoAccountsRemoved: removed };
  });
  app.post('/api/inbound/email', (req) => {
    inboundGuard(req);
    const b = req.body;
    return inbound.processEmail({ to: b.to || b.recipient, from: b.from || b.sender, subject: b.subject, text: b.text || b['body-plain'] || b['stripped-text'], dkim: b.dkim || (b['X-Mailgun-Dkim-Check-Result'] === 'Pass' ? 'pass' : undefined) });
  });
  app.post('/api/inbound/sms', (req) => { inboundGuard(req); return inbound.processSms({ to: req.body.to || req.body.To, from: req.body.from || req.body.From, text: req.body.text || req.body.Body }); });
  app.post('/api/inbound/call', (req) => { inboundGuard(req); return inbound.processCall({ to: req.body.to || req.body.To, from: req.body.from || req.body.From, callerName: req.body.callerName }); });

  // ---------- browser extension ----------
  app.post('/api/ext/token', (req) => { U(req); return { token: auth.startSession({ cookie() {} }, req.user) }; });
  app.get('/api/ext/site', async (req) => {
    U(req);
    const domain = rootDomain(domainOf(req.query.url || req.query.domain));
    if (!domain) throw bad('No site');
    const cat = findInCatalog(domain);
    const company = db.find('companies', c => c.domains?.includes(domain)) || (cat ? getOrCreateCompany({ domain }) : null);
    const address = company ? addressFor(req.user.id, company.id) : null;
    const policy = company ? await getPolicy(company).catch(() => null) : null;
    return { domain, company: publicCompany(company), address, protectedNumber: auth.shownNumber(req.user), bullets: policy?.bullets?.slice(0, 3) || [], summary: policy?.summary || null };
  });

  // ---------- public ----------
  app.get('/api/public/scores', () => stats.companyScores());

  // ---------- printable documents ----------
  app.get('/api/docs/certificate/:id', async (req, res) => { U(req); res.send(await docs.certificateHtml(req.user, req.params.id)); });
  app.get('/api/docs/complaint/:id', (req, res) => { U(req); res.send(docs.complaintHtml(req.user, req.params.id)); });
  app.get('/api/docs/evidence/:id', (req, res) => { U(req); res.send(docs.evidenceHtml(req.user, req.params.id)); });

  // ---------- demo controls (demo accounts only) ----------
  const D = (req) => {
    if (!config.demoMode) throw forbidden('Demo mode is off on this server (DEMO_MODE=false)');
    U(req);
    if (!req.user.demo) throw forbidden('Demo controls only work in a demo account, so they never touch real data.');
  };
  app.post('/api/demo/advance', (req) => { D(req); return demo.advance(req.user, req.body.days); });
  app.post('/api/demo/reset-clock', (req) => { D(req); resetClock(req.user); return { offsetDays: 0 }; });
  app.post('/api/demo/leak', (req) => { D(req); return demo.simulateLeak(req.user); });
  app.post('/api/demo/email', (req) => {
    D(req);
    // Only to this demo account's own protected addresses
    const to = String(req.body.to || '').toLowerCase();
    if (!db.find('addresses', a => a.userId === req.user.id && a.email === to)) throw bad('Choose one of your own protected addresses');
    return inbound.processEmail({ ...req.body, to });
  });
  app.post('/api/demo/sms', (req) => { D(req); return inbound.processSms({ to: req.user.protectedNumber, from: req.body.from, text: req.body.text }); });
  app.post('/api/demo/call', (req) => { D(req); return inbound.processCall({ to: req.user.protectedNumber, from: req.body.from, callerName: req.body.callerName }); });
  app.post('/api/demo/anchor', (req) => { D(req); return demo.anchorNow(); });
  app.post('/api/demo/story', (req) => { D(req); return demo.setupStory(req.user); });
  app.post('/api/demo/replies', (req) => { D(req); return demo.repliesNow(req.user); });
}
