// Signed session tokens (HMAC-SHA256), like a minimal JWT.
import crypto from 'node:crypto';
import { config } from '../config.js';

const b64 = (b) => Buffer.from(b).toString('base64url');

export function sign(payload, ttlSec = 60 * 60 * 24 * 14) {
  const body = b64(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSec }));
  const sig = crypto.createHmac('sha256', config.jwtSecret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verify(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expect = crypto.createHmac('sha256', config.jwtSecret).update(body).digest('base64url');
  if (sig.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (p.exp && p.exp < Date.now() / 1000) return null;
    return p;
  } catch { return null; }
}

export const hashSecret = (s) => crypto.createHash('sha256').update(config.jwtSecret + ':' + s).digest('hex');
