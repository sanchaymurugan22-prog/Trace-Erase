// End-to-end API smoke test. Start the app first (npm run dev), then: npm run test
// Starts a demo account, scans, sends a deletion request to Zomato and MakeMyTrip, lets the
// demo companies reply (Zomato names Razorpay and AdNexa), escalates AdNexa, simulates a leak,
// files the complaint, verifies by silence and issues the certificate.
const API = process.env.API || 'http://localhost:4000';
const jar = {};
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function call(method, path, body) {
  const r = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json', cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ') }, body: body ? JSON.stringify(body) : undefined });
  const sc = r.headers.get('set-cookie');
  for (const c of r.headers.getSetCookie?.() || (sc ? [sc] : [])) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar[kv.slice(0, i)] = kv.slice(i + 1); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status} ${j.error}`);
  return j;
}
const step = (s) => console.log('\n▶', s);
const show = (r) => console.log('  ', r.targets.map(t => `${t.company.name}${t.via ? ` (via ${t.via.name})` : ''}: ${t.status}`).join(' · '));
let failures = 0;
const expect = (ok, what) => { console.log(ok ? '   ✓' : '   ✗', what); if (!ok) failures++; };

// The story uses a demo account (sample data, demo clock, pretend companies). Real accounts never get these.
step('Start a demo account');
const v = await call('POST', '/api/demo/start', { name: 'Test User' });
console.log('   demo account, protected number', v.user.protectedNumber);

step('Scan sample inbox');
let scan = await call('POST', '/api/scan', { source: 'sample' });
while (scan.status === 'running') { await sleep(500); scan = await call('GET', '/api/scan/' + scan.id); }
console.log('   found', scan.found, '·', scan.summary?.headline);
expect(scan.found > 20, 'scan finds companies');

step('Demo story: Zomato and MakeMyTrip know you by protected addresses');
const story = await call('POST', '/api/demo/story');
console.log('  ', story.companies.map(c => `${c.company} → ${c.address}`).join(' · '));

step('Draft + sign deletion request');
const ids = story.companies.map(c => c.companyId);
const draft = await call('POST', '/api/requests/draft', { companyIds: ids });
console.log('   targets:', draft.targets.map(t => `${t.company.name}(${t.channel})`).join(', '));
const signed = await call('POST', `/api/requests/${draft.id}/sign`, {});
expect(signed.status === 'active', 'request active');

step('+1 day: Zomato replies, names Razorpay and AdNexa');
await call('POST', '/api/demo/advance', { days: 1 });
let r = await call('GET', '/api/requests/' + draft.id); show(r);
const zt = r.targets.find(t => t.company.key === 'zomato');
expect(zt.status === 'partial', 'Zomato partial (kept invoices)');
expect(r.targets.some(t => t.company.key === 'razorpay') && r.targets.some(t => t.company.key === 'adnexa'), 'partners added from the reply');

step('+2 days: Razorpay replies');
await call('POST', '/api/demo/advance', { days: 2 });
r = await call('GET', '/api/requests/' + draft.id); show(r);
expect(r.targets.find(t => t.company.key === 'razorpay')?.status === 'partial', 'Razorpay partial');

step('+5 days: reminders go out, MakeMyTrip answers after its reminder');
await call('POST', '/api/demo/advance', { days: 5 });
r = await call('GET', '/api/requests/' + draft.id); show(r);
expect(r.targets.find(t => t.company.key === 'makemytrip')?.status === 'claimed', 'MakeMyTrip claimed');

step('+8 days: AdNexa ignored everything → complaint');
await call('POST', '/api/demo/advance', { days: 8 });
r = await call('GET', '/api/requests/' + draft.id); show(r);
const ad = r.targets.find(t => t.company.key === 'adnexa');
expect(ad.status === 'overdue' && !!ad.complaintId, 'AdNexa overdue with complaint');

step('Leak: PizzaPoint emails the Zomato-only address');
const leak = await call('POST', '/api/demo/leak');
const L = await call('GET', '/api/leaks/' + leak.leakId);
console.log('   likely source:', L.investigation.likelySourceName, L.investigation.confidence, '·', L.investigation.reasons[0]);
expect(/adnexa/i.test(L.investigation.likelySourceName), 'traced to AdNexa');

step('File complaint');
const filed = await call('POST', `/api/complaints/${ad.complaintId}/file`, {});
console.log('   filed', filed.reference);

step('+30 days: MakeMyTrip-only address stayed silent → verified');
await call('POST', '/api/demo/advance', { days: 30 });
r = await call('GET', '/api/requests/' + draft.id); show(r);
expect(r.targets.find(t => t.company.key === 'makemytrip')?.status === 'verified', 'MakeMyTrip verified by silence');

step('Certificate, assistant, ledger, dashboard, regulator');
const cert = await call('POST', `/api/requests/${draft.id}/certificate`);
console.log('   certificate', cert.number, cert.rows.map(x => `${x.company}:${x.status}`).join(', '));
const ans = await call('POST', '/api/assistant', { question: 'How did PizzaPoint get my email?' });
console.log('   assistant:', ans.message.text);
await call('POST', '/api/demo/anchor');
const rec = await call('GET', '/api/receipts');
const ver = await call('GET', '/api/verify/' + rec[0].id);
expect(ver.valid, `receipt verifies (batch #${ver.batch?.number})`);
const dash = await call('GET', '/api/dashboard');
console.log('   dashboard score', dash.score.score);
await call('POST', '/api/auth/staff/login', { email: 'regulator@traceerase.demo', password: process.env.REGULATOR_PASSWORD || 'Regulator@2026' });
const reg = await call('GET', '/api/regulator/overview');
console.log('   regulator pattern:', reg.pattern?.headline);
await call('POST', '/api/demo/reset-clock');
console.log(failures ? `\n✗ ${failures} check(s) failed` : '\n✔ smoke test passed');
process.exit(failures ? 1 : 0);
