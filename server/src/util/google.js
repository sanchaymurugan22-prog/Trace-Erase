// Google service-account access tokens (OAuth 2.0 JWT bearer flow) with Node's crypto only.
// The service account comes from FIREBASE_SERVICE_ACCOUNT: the JSON key file's contents, or the same in base64.
import crypto from 'node:crypto';

let account = null;
let cached = { token: null, exp: 0, scope: '' };

/** Parses FIREBASE_SERVICE_ACCOUNT once. Returns null when it is not set. */
export function serviceAccount() {
  if (account !== null) return account || null;
  const raw = (process.env.FIREBASE_SERVICE_ACCOUNT || '').trim();
  if (!raw) { account = false; return null; }
  try {
    // Accept the JSON (even with stray text pasted around it) or the same in base64
    const json = raw.includes('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
    const text = json.slice(json.indexOf('{'), json.lastIndexOf('}') + 1);
    const j = JSON.parse(text);
    if (!j.client_email || !j.private_key) throw new Error('missing client_email or private_key');
    // Keys pasted into dashboards sometimes keep "\n" as two characters
    j.private_key = j.private_key.replace(/\\n/g, '\n');
    account = j;
    return j;
  } catch (e) {
    console.error('[google] FIREBASE_SERVICE_ACCOUNT is not a valid service account key:', e.message);
    account = false;
    return null;
  }
}

const b64url = (v) => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url');

/** An OAuth access token for the service account (cached until a minute before it expires). */
export async function accessToken(scope = 'https://www.googleapis.com/auth/datastore') {
  const sa = serviceAccount();
  if (!sa) throw new Error('No service account configured');
  if (cached.token && cached.scope === scope && cached.exp > Date.now() + 60_000) return cached.token;
  const tokenUri = sa.token_uri || 'https://oauth2.googleapis.com/token';
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64url({ alg: 'RS256', typ: 'JWT', kid: sa.private_key_id })}.${b64url({ iss: sa.client_email, scope, aud: tokenUri, iat: now, exp: now + 3600 })}`;
  const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(sa.private_key).toString('base64url');
  const r = await fetch(tokenUri, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(`Google token error ${r.status}: ${j.error_description || j.error || 'unknown'}`);
  cached = { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000, scope };
  return cached.token;
}

export const projectId = () => process.env.FIREBASE_PROJECT_ID || serviceAccount()?.project_id || '';
