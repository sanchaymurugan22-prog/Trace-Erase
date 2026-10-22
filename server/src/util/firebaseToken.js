// Verifies Firebase Authentication ID tokens (RS256 JWTs signed by Google) with Node's crypto only.
// https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library
import crypto from 'node:crypto';
import { projectId } from './google.js';

const CERTS_URL = () => process.env.FIREBASE_CERTS_URL || 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
let certs = { keys: {}, exp: 0 };

async function publicKeys() {
  if (certs.exp > Date.now()) return certs.keys;
  const r = await fetch(CERTS_URL());
  if (!r.ok) throw new Error('Could not download Google sign-in keys');
  const maxAge = Number((r.headers.get('cache-control') || '').match(/max-age=(\d+)/)?.[1] || 3600);
  certs = { keys: await r.json(), exp: Date.now() + maxAge * 1000 };
  return certs.keys;
}

const part = (s) => JSON.parse(Buffer.from(s, 'base64url').toString('utf8'));

/** Returns the token's claims, or throws if it is not a valid ID token for this Firebase project. */
export async function verifyIdToken(token) {
  const pid = projectId();
  if (!pid) throw new Error('FIREBASE_PROJECT_ID is not set on the server');
  const pieces = String(token || '').split('.');
  if (pieces.length !== 3) throw new Error('Malformed sign-in token');
  const [h, p, sig] = pieces;
  const header = part(h);
  const claims = part(p);
  if (header.alg !== 'RS256') throw new Error('Unexpected token algorithm');
  let pem = (await publicKeys())[header.kid];
  if (!pem) { certs.exp = 0; pem = (await publicKeys())[header.kid]; } // keys rotate
  if (!pem) throw new Error('Unknown signing key');
  const key = crypto.createPublicKey(pem); // accepts X.509 certificates and public keys
  const ok = crypto.createVerify('RSA-SHA256').update(`${h}.${p}`).verify(key, Buffer.from(sig, 'base64url'));
  if (!ok) throw new Error('Invalid sign-in token');
  const now = Math.floor(Date.now() / 1000);
  if (claims.aud !== pid) throw new Error('Sign-in token is for another project');
  if (claims.iss !== `https://securetoken.google.com/${pid}`) throw new Error('Sign-in token has the wrong issuer');
  if (!claims.sub || typeof claims.sub !== 'string') throw new Error('Sign-in token has no user');
  if (claims.exp <= now) throw new Error('Sign-in expired, please try again');
  if (claims.iat > now + 300 || (claims.auth_time && claims.auth_time > now + 300)) throw new Error('Sign-in token is from the future');
  return claims;
}
