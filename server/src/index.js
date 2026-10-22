import fs from 'node:fs';
import path from 'node:path';
import { config, SERVER_ROOT, envLoaded, devMailOnly, ENV_FILE } from './config.js';
import { updateEnvFile } from './util/env.js';
import { createApp } from './http.js';
import { registerRoutes } from './routes.js';
import { startLedger, runBatch } from './services/ledger.js';
import { startEscalation, escalate } from './services/requests.js';
import { aiStatus, generate, mainModelCandidates } from './ai/gemini.js';
import { seedStaff } from './services/staff.js';
import { storage, db } from './db.js';

// Mirror console output to logs/server.log so problems are easy to share.
const logDir = path.resolve(SERVER_ROOT, '..', 'logs');
fs.mkdirSync(logDir, { recursive: true });
const logFile = fs.createWriteStream(path.join(logDir, 'server.log'), { flags: 'a' });
for (const level of ['log', 'warn', 'error']) {
  const orig = console[level].bind(console);
  console[level] = (...args) => {
    orig(...args);
    try { logFile.write(`[${new Date().toISOString()}] ${level.toUpperCase()} ${args.map(a => a instanceof Error ? a.stack : typeof a === 'string' ? a : JSON.stringify(a)).join(' ')}\n`); } catch {}
  };
}

seedStaff();
const app = createApp();

// The website (Firebase Hosting, APP_URL) and local development may call the API from another address
app.cors([...config.appOrigins, 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4000']);
app.use((req, res) => { res.setHeader('X-Content-Type-Options', 'nosniff'); });

registerRoutes(app);

const dist = path.resolve(SERVER_ROOT, '..', 'client', 'dist');
if (fs.existsSync(path.join(dist, 'index.html'))) app.static(dist);

app.listen(config.port, () => {
  const ai = aiStatus();
  console.log(`\n  TraceErase API running on http://localhost:${config.port}`);
  console.log(`  .env loaded: ${envLoaded ? 'yes' : 'no (copy server/.env.example to server/.env)'}`);
  console.log(`  Storage: ${storage === 'firestore' ? `Firestore (${db.all('users').length} users loaded)` : 'local file server/data/db.json'}`);
  console.log(`  Gemini: ${ai.configured ? `key set (${config.geminiKey.slice(0, 4)}…), model ${config.geminiModel}, checking…` : 'not configured, using built-in rules'}`);
  console.log(`  Regulator logins: ${config.regulators.map(r => r.email).join(', ') || 'none'}`);
  console.log(`  Email: ${devMailOnly ? 'Dev outbox (no Brevo/SMTP)' : config.brevo.apiKey ? 'Brevo' : 'SMTP ' + config.smtp.host}  ·  Real requests: ${config.sendRequestsForReal ? 'ON' : 'off'}  ·  Demo mode: ${config.demoMode ? 'on' : 'off'}\n`);
  startLedger();
  startEscalation();
  setTimeout(() => { escalate().catch(() => {}); runBatch().catch(() => {}); }, 2000);
  // Find out right away whether the Gemini key works, so the app shows the real AI status
  // Check the main model (the quick "lite" model is only a last resort), and save whichever works
  if (ai.configured) generate({ feature: 'startup-check', prompt: 'Reply with exactly: ok', temperature: 0, maxTokens: 10, models: mainModelCandidates() })
    .then(() => {
      const s = aiStatus();
      console.log(`  Gemini: working (${s.provider === 'studio' ? 'AI Studio' : 'Vertex AI'}, ${s.model})`);
      // Remember the model that works, so the next start uses it first
      if (s.model && (s.model !== config.geminiModel || s.provider !== config.geminiProvider)) {
        try { updateEnvFile(ENV_FILE, { GEMINI_PROVIDER: s.provider, GEMINI_MODEL: s.model }); console.log(`  Saved GEMINI_MODEL=${s.model} to server/.env`); } catch {}
      }
    })
    .catch((e) => { const s = aiStatus(); console.warn(`  Gemini: NOT working. ${s.hint || s.lastError || e?.message || 'unknown error'}`); });
});
