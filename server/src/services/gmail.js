// Optional real Gmail scan (read-only metadata: From, Subject, Date). Needs a Google OAuth client.
import { config } from '../config.js';
import { db } from '../db.js';
import { sign, verify } from '../util/token.js';

export const gmailConfigured = () => !!(config.google.clientId && config.google.clientSecret);

export function authUrl(userId) {
  const state = sign({ uid: userId, t: 'gmail' }, 600);
  const p = new URLSearchParams({
    client_id: config.google.clientId, redirect_uri: config.google.redirectUri, response_type: 'code',
    scope: 'https://www.googleapis.com/auth/gmail.metadata', access_type: 'offline', prompt: 'consent', state
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

export async function handleCallback({ code, state }) {
  const s = verify(state);
  if (!s || s.t !== 'gmail') throw new Error('Invalid sign-in state');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: config.google.clientId, client_secret: config.google.clientSecret, redirect_uri: config.google.redirectUri, grant_type: 'authorization_code' })
  });
  const tok = await r.json();
  if (!r.ok) throw new Error(tok.error_description || 'Google sign-in failed');
  db.update('users', s.uid, { gmail: { refreshToken: tok.refresh_token, accessToken: tok.access_token, expiresAt: Date.now() + tok.expires_in * 1000, connectedAt: new Date().toISOString() } });
  return s.uid;
}

async function accessToken(user) {
  const g = user.gmail;
  if (g.accessToken && g.expiresAt > Date.now() + 60000) return g.accessToken;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ refresh_token: g.refreshToken, client_id: config.google.clientId, client_secret: config.google.clientSecret, grant_type: 'refresh_token' })
  });
  const tok = await r.json();
  if (!r.ok) throw new Error('Gmail access expired. Please reconnect Gmail.');
  db.update('users', user.id, { gmail: { ...g, accessToken: tok.access_token, expiresAt: Date.now() + tok.expires_in * 1000 } });
  return tok.access_token;
}

/** Returns [{from, subject, date}] for up to `max` recent messages. */
const GMAIL = () => (process.env.GMAIL_BASE_URL || 'https://gmail.googleapis.com').replace(/\/$/, '');
/** `givenToken`: a short-lived read-only token from "Continue with Google" in the browser (never stored). */
export async function fetchHeaders(user, max = 400, onProgress = () => {}, givenToken = null) {
  const token = givenToken || await accessToken(user);
  const H = { Authorization: `Bearer ${token}` };
  const ids = [];
  let pageToken = '';
  while (ids.length < max) {
    const u = new URL(`${GMAIL()}/gmail/v1/users/me/messages`);
    u.searchParams.set('maxResults', String(Math.min(500, max - ids.length)));
    if (pageToken) u.searchParams.set('pageToken', pageToken);
    const r = await fetch(u, { headers: H });
    const j = await r.json();
    if (r.status === 401) throw new Error('Google access expired. Please press "Scan my Gmail" again.');
    if (r.status === 403) throw new Error(/has not been used|disabled/i.test(j.error?.message || '') ? 'The Gmail API is not switched on for this app yet (Google Cloud → APIs → Gmail API → Enable).' : 'Google did not allow reading your Gmail. Please allow "View your email message metadata" when asked.');
    if (!r.ok) throw new Error(j.error?.message || 'Gmail list failed');
    ids.push(...(j.messages || []).map(m => m.id));
    if (!j.nextPageToken) break;
    pageToken = j.nextPageToken;
  }
  const out = [];
  for (let i = 0; i < ids.length; i += 10) {
    const chunk = ids.slice(i, i + 10);
    const rows = await Promise.all(chunk.map(async id => {
      const r = await fetch(`${GMAIL()}/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`, { headers: H });
      if (!r.ok) return null;
      const j = await r.json();
      const h = Object.fromEntries((j.payload?.headers || []).map(x => [x.name.toLowerCase(), x.value]));
      return { from: h.from || '', subject: h.subject || '', date: h.date ? new Date(h.date).toISOString() : new Date(Number(j.internalDate)).toISOString() };
    }));
    out.push(...rows.filter(Boolean));
    onProgress(out.length, ids.length);
  }
  return out;
}
