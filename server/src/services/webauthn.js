// Passkeys (WebAuthn) implemented with node:crypto only.
// Handles registration (attestation "none") and authentication / signing for ES256, RS256 and EdDSA keys.
import crypto from 'node:crypto';
import { config } from '../config.js';
import { db } from '../db.js';
import { bad } from '../http.js';

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const fromB64u = (s) => Buffer.from(String(s), 'base64url');

// ---------- CBOR (just enough for WebAuthn) ----------
function decodeCbor(buf, pos = 0) {
  const ib = buf[pos++];
  const major = ib >> 5;
  let info = ib & 0x1f;
  let len;
  if (info < 24) len = info;
  else if (info === 24) { len = buf[pos]; pos += 1; }
  else if (info === 25) { len = buf.readUInt16BE(pos); pos += 2; }
  else if (info === 26) { len = buf.readUInt32BE(pos); pos += 4; }
  else if (info === 27) { len = Number(buf.readBigUInt64BE(pos)); pos += 8; }
  else if (info === 31) throw new Error('Indefinite-length CBOR is not supported');
  switch (major) {
    case 0: return { value: len, pos };
    case 1: return { value: -1 - len, pos };
    case 2: return { value: buf.subarray(pos, pos + len), pos: pos + len };
    case 3: return { value: buf.subarray(pos, pos + len).toString('utf8'), pos: pos + len };
    case 4: { const arr = []; for (let i = 0; i < len; i++) { const r = decodeCbor(buf, pos); arr.push(r.value); pos = r.pos; } return { value: arr, pos }; }
    case 5: { const map = new Map(); for (let i = 0; i < len; i++) { const k = decodeCbor(buf, pos); const v = decodeCbor(buf, k.pos); map.set(k.value, v.value); pos = v.pos; } return { value: map, pos }; }
    case 6: return decodeCbor(buf, pos); // tag: ignore
    case 7:
      if (info === 20) return { value: false, pos };
      if (info === 21) return { value: true, pos };
      if (info === 22 || info === 23) return { value: null, pos };
      if (info === 25 || info === 26 || info === 27) return { value: 0, pos }; // floats not used here
      throw new Error('Unsupported CBOR simple value');
    default: throw new Error('Bad CBOR');
  }
}

function parseAuthData(ad) {
  const rpIdHash = ad.subarray(0, 32);
  const flags = ad[32];
  const signCount = ad.readUInt32BE(33);
  const out = { rpIdHash, flags, up: !!(flags & 0x01), uv: !!(flags & 0x04), at: !!(flags & 0x40), signCount };
  if (out.at) {
    let p = 37;
    out.aaguid = ad.subarray(p, p + 16); p += 16;
    const idLen = ad.readUInt16BE(p); p += 2;
    out.credentialId = ad.subarray(p, p + idLen); p += idLen;
    const key = decodeCbor(ad, p);
    out.cose = key.value;
  }
  return out;
}

function coseToKey(cose) {
  const kty = cose.get(1), alg = cose.get(3);
  if (kty === 2) {
    const crv = { 1: 'P-256', 2: 'P-384', 3: 'P-521' }[cose.get(-1)];
    const jwk = { kty: 'EC', crv, x: b64u(cose.get(-2)), y: b64u(cose.get(-3)) };
    return { jwk, alg: alg ?? -7 };
  }
  if (kty === 3) return { jwk: { kty: 'RSA', n: b64u(cose.get(-1)), e: b64u(cose.get(-2)) }, alg: alg ?? -257 };
  if (kty === 1) return { jwk: { kty: 'OKP', crv: 'Ed25519', x: b64u(cose.get(-2)) }, alg: alg ?? -8 };
  throw new Error('Unsupported key type ' + kty);
}

function verifySig(stored, data, sig) {
  const key = crypto.createPublicKey({ key: stored.jwk, format: 'jwk' });
  if (stored.alg === -8) return crypto.verify(null, data, key, sig);
  if (stored.alg === -257) return crypto.verify('sha256', data, { key, padding: crypto.constants.RSA_PKCS1_PADDING }, sig);
  const hash = { 'P-384': 'sha384', 'P-521': 'sha512' }[stored.jwk.crv] || 'sha256';
  return crypto.verify(hash, data, key, sig);
}

const allowedOrigins = () => [...new Set([config.rpOrigin, config.appUrl, config.apiUrl,
  'http://localhost:5173', 'http://localhost:4000', 'http://127.0.0.1:5173'])];

function checkClientData(clientDataB64, type, expectedChallenge) {
  const raw = fromB64u(clientDataB64);
  let cd;
  try { cd = JSON.parse(raw.toString('utf8')); } catch { throw bad('Invalid passkey response'); }
  if (cd.type !== type) throw bad('Wrong passkey operation');
  if (cd.challenge !== expectedChallenge) throw bad('Passkey challenge did not match. Please try again.');
  if (!allowedOrigins().includes(cd.origin)) throw bad(`Passkey origin ${cd.origin} is not allowed`);
  return raw;
}

function rpIdFor() { return config.rpId; }

// ---------- challenges ----------
export function newChallenge({ userId = null, purpose, payloadHash = null, bytes }) {
  const challenge = b64u(bytes || crypto.randomBytes(32));
  db.remove('challenges', c => new Date(c.expiresAt) < new Date());
  const rec = db.insert('challenges', { userId, purpose, challenge, payloadHash, expiresAt: new Date(Date.now() + 5 * 60000).toISOString() });
  return rec;
}
function takeChallenge(challenge, purpose) {
  const rec = db.find('challenges', c => c.challenge === challenge && c.purpose === purpose);
  if (!rec || new Date(rec.expiresAt) < new Date()) throw bad('This passkey request expired. Please try again.');
  db.remove('challenges', c => c.id === rec.id);
  return rec;
}

// ---------- registration ----------
export function registrationOptions(user) {
  const ch = newChallenge({ userId: user.id, purpose: 'register' });
  const existing = db.filter('passkeys', p => p.userId === user.id);
  return {
    challenge: ch.challenge,
    rp: { name: config.rpName, id: rpIdFor() },
    user: { id: b64u(Buffer.from(user.id)), name: user.email || user.phone, displayName: user.name || user.email },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -8 }, { type: 'public-key', alg: -257 }],
    timeout: 60000,
    attestation: 'none',
    authenticatorSelection: { residentKey: 'preferred', requireResidentKey: false, userVerification: 'preferred' },
    excludeCredentials: existing.map(p => ({ type: 'public-key', id: p.credentialId, transports: p.transports || [] }))
  };
}

export function verifyRegistration(user, credential, label) {
  if (!credential?.response?.clientDataJSON || !credential?.response?.attestationObject) throw bad('Missing passkey data');
  const cd = JSON.parse(fromB64u(credential.response.clientDataJSON).toString());
  const ch = takeChallenge(cd.challenge, 'register');
  if (ch.userId !== user.id) throw bad('Passkey request belongs to another account');
  checkClientData(credential.response.clientDataJSON, 'webauthn.create', ch.challenge);
  const att = decodeCbor(fromB64u(credential.response.attestationObject)).value;
  const auth = parseAuthData(att.get('authData'));
  const expectedRp = crypto.createHash('sha256').update(rpIdFor()).digest();
  if (!auth.rpIdHash.equals(expectedRp)) throw bad('Passkey was made for a different site');
  if (!auth.up) throw bad('Passkey needs user presence');
  if (!auth.at || !auth.credentialId) throw bad('No credential in passkey response');
  const key = coseToKey(auth.cose);
  const credentialId = b64u(auth.credentialId);
  if (db.find('passkeys', p => p.credentialId === credentialId)) throw bad('This passkey is already registered');
  return db.insert('passkeys', {
    userId: user.id, credentialId, jwk: key.jwk, alg: key.alg, counter: auth.signCount,
    transports: credential.response.transports || [], label: label || 'Passkey', userVerified: auth.uv, lastUsed: null
  });
}

// ---------- authentication / signing ----------
export function authenticationOptions({ userId = null, purpose = 'login', payloadHash = null }) {
  let bytes;
  if (payloadHash) bytes = Buffer.concat([Buffer.from(payloadHash.replace(/^0x/, ''), 'hex'), crypto.randomBytes(8)]);
  const ch = newChallenge({ userId, purpose, payloadHash, bytes });
  const creds = userId ? db.filter('passkeys', p => p.userId === userId) : [];
  return {
    challenge: ch.challenge,
    rpId: rpIdFor(),
    timeout: 60000,
    userVerification: 'preferred',
    allowCredentials: creds.map(p => ({ type: 'public-key', id: p.credentialId, transports: p.transports || [] }))
  };
}

/** Verifies an assertion. Returns { passkey, challenge, signature } on success. */
export function verifyAssertion(credential, purpose) {
  if (!credential?.response?.clientDataJSON) throw bad('Missing passkey data');
  const cdRaw = fromB64u(credential.response.clientDataJSON);
  const cd = JSON.parse(cdRaw.toString());
  const ch = takeChallenge(cd.challenge, purpose);
  checkClientData(credential.response.clientDataJSON, 'webauthn.get', ch.challenge);
  const credentialId = credential.id || credential.rawId;
  const pk = db.find('passkeys', p => p.credentialId === credentialId);
  if (!pk) throw bad('This passkey is not registered with TraceErase');
  if (ch.userId && ch.userId !== pk.userId) throw bad('Passkey belongs to another account');
  const authData = fromB64u(credential.response.authenticatorData);
  const auth = parseAuthData(authData);
  const expectedRp = crypto.createHash('sha256').update(rpIdFor()).digest();
  if (!auth.rpIdHash.equals(expectedRp)) throw bad('Passkey was made for a different site');
  if (!auth.up) throw bad('Passkey needs user presence');
  const signed = Buffer.concat([authData, crypto.createHash('sha256').update(cdRaw).digest()]);
  const sig = fromB64u(credential.response.signature);
  if (!verifySig(pk, signed, sig)) throw bad('Passkey signature is not valid');
  const cloned = pk.counter > 0 && auth.signCount > 0 && auth.signCount <= pk.counter;
  db.update('passkeys', pk.id, { counter: auth.signCount, lastUsed: new Date().toISOString() });
  return {
    passkey: pk,
    challenge: ch,
    warning: cloned ? 'Signature counter did not increase' : null,
    signature: {
      credentialId: pk.credentialId,
      alg: pk.alg,
      authenticatorData: credential.response.authenticatorData,
      clientDataJSON: credential.response.clientDataJSON,
      signature: credential.response.signature,
      userVerified: auth.uv
    }
  };
}

// Exposed for tests
export const _internals = { decodeCbor, parseAuthData, coseToKey, verifySig };
