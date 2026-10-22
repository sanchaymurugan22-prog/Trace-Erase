import { loadEnv } from './util/env.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_ROOT = path.resolve(here, '..');
export const ENV_FILE = path.join(SERVER_ROOT, '.env');
export const envLoaded = loadEnv(ENV_FILE);

const env = (k, d = '') => (process.env[k] ?? d).toString().trim();
const num = (k, d) => Number(process.env[k] || d);
const bool = (k, d = false) => {
  const v = process.env[k];
  if (v === undefined || v === '') return d;
  return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
};

// Current Gemini models (Oct 2026). 2.x models only work for projects that already used them.
export const DEFAULT_MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-2.5-flash'];

function build() { return {
  port: num('PORT', 4000),
  // APP_URL may list several website addresses, comma separated; the first is used in links
  appUrl: env('APP_URL', 'http://localhost:5173').split(',')[0].trim().replace(/\/$/, ''),
  appOrigins: env('APP_URL', 'http://localhost:5173').split(',').map(s => s.trim().replace(/\/$/, '')).filter(Boolean),
  inboundSecret: env('INBOUND_SECRET'),
  cronSecret: env('CRON_SECRET'),
  // Firebase (sign-in): the public web config is safe to share with the browser
  firebase: { projectId: env('FIREBASE_PROJECT_ID'), apiKey: env('FIREBASE_WEB_API_KEY') },
  apiUrl: env('API_URL', 'http://localhost:4000'),
  jwtSecret: env('JWT_SECRET', 'change-me-in-production-' + SERVER_ROOT),
  dataDir: path.resolve(SERVER_ROOT, env('DATA_DIR', 'data')),
  protectedDomain: env('PROTECTED_EMAIL_DOMAIN', 'te.mail'),
  protectedNumberPrefix: env('PROTECTED_NUMBER_PREFIX', '+91 70000'),

  // AI
  geminiKey: env('GEMINI_API_KEY'),
  geminiModel: env('GEMINI_MODEL', DEFAULT_MODELS[0]),
  geminiFastModel: env('GEMINI_FAST_MODEL', 'gemini-3.5-flash-lite'),
  geminiFallbackModels: env('GEMINI_FALLBACK_MODELS', DEFAULT_MODELS.slice(1).join(','))
    .split(',').map(s => s.trim()).filter(Boolean),
  geminiProvider: env('GEMINI_PROVIDER', 'auto'), // auto | vertex | studio
  aiDisabled: bool('AI_DISABLED', false),

  // WebAuthn (passkeys)
  rpId: env('WEBAUTHN_RP_ID', 'localhost'),
  rpName: env('WEBAUTHN_RP_NAME', 'TraceErase'),
  rpOrigin: env('WEBAUTHN_ORIGIN', 'http://localhost:5173'),

  // Email (optional; without it codes and outgoing mail show in the dev outbox)
  smtp: {
    host: env('SMTP_HOST'),
    port: num('SMTP_PORT', 587),
    user: env('SMTP_USER'),
    pass: env('SMTP_PASS'),
    from: env('SMTP_FROM', 'TraceErase <no-reply@traceerase.local>')
  },
  // Brevo (free email sending over HTTPS; used instead of SMTP when set)
  brevo: {
    apiKey: env('BREVO_API_KEY'),
    baseUrl: env('BREVO_BASE_URL', 'https://api.brevo.com'),
    from: env('MAIL_FROM', '') // e.g. "TraceErase <hello@yourdomain>"
  },
  // SMS (optional, Twilio)
  twilio: {
    sid: env('TWILIO_ACCOUNT_SID'),
    token: env('TWILIO_AUTH_TOKEN'),
    from: env('TWILIO_FROM')
  },
  // Gmail OAuth (optional)
  google: {
    clientId: env('GOOGLE_CLIENT_ID'),
    clientSecret: env('GOOGLE_CLIENT_SECRET'),
    redirectUri: env('GOOGLE_REDIRECT_URI', 'http://localhost:4000/api/gmail/callback')
  },
  // Blockchain anchoring (optional; without it roots are anchored in the local hash-chained ledger)
  chain: {
    rpcUrl: env('ANCHOR_RPC_URL'),
    privateKey: env('ANCHOR_PRIVATE_KEY'),
    contract: env('ANCHOR_CONTRACT'),
    network: env('ANCHOR_NETWORK_NAME', 'Polygon Amoy')
  },
  batchIntervalSec: num('LEDGER_BATCH_SECONDS', 60),
  escalation: { reminderDay: 7, grievanceDay: 10, complaintDay: 15, legalDeadlineDay: 30 },
  // Deletion requests to real companies are only emailed when this is true AND SMTP is set
  sendRequestsForReal: bool('SEND_REAL_REQUESTS', false),
  demoMode: bool('DEMO_MODE', true),
  // Built-in regulator accounts ("email:password" pairs, comma separated)
  regulators: env('REGULATOR_ACCOUNTS', 'regulator@traceerase.demo:Regulator@2026,board.officer@traceerase.demo:Board@2026')
    .split(',').map(s => s.trim()).filter(Boolean).map(p => { const i = p.indexOf(':'); return { email: p.slice(0, i).toLowerCase(), password: p.slice(i + 1) }; })
}; }

export const config = build();
/** Protected email addresses can receive real mail only with your own domain and the email worker set up. */
// On your own computer (no Firestore) everything works with the Dev outbox, as before.
export const inboxReady = () => !process.env.FIREBASE_SERVICE_ACCOUNT || !!(process.env.PROTECTED_EMAIL_DOMAIN && process.env.PROTECTED_EMAIL_DOMAIN !== 'te.mail' && config.inboundSecret);
/** Demo accounts always use (pretend) protected addresses; real accounts only when the inbox is ready. */
export const usesProtectedEmail = (user) => !!(user?.demo || inboxReady());
const mailReady = (c) => !!(c.brevo.apiKey || c.smtp.host);
export let devMailOnly = !mailReady(config);

/** Re-read server/.env (after the app or a script changed it) without restarting. */
export function reloadConfig() {
  loadEnv(ENV_FILE, { override: true });
  Object.assign(config, build());
  devMailOnly = !mailReady(config);
  return config;
}
