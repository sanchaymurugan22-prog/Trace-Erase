// Firestore over its REST API (no SDK). Each record is stored as one document in the collection
// "te_<name>": { j: <record as JSON text>, s: <order number> }. Storing JSON text keeps every record
// exactly as the app wrote it (Firestore can't store some shapes, like arrays inside arrays).
import crypto from 'node:crypto';
import { accessToken, projectId } from '../util/google.js';

const base = () => (process.env.FIRESTORE_BASE_URL || 'https://firestore.googleapis.com/v1').replace(/\/$/, '');
const root = () => `projects/${projectId()}/databases/(default)/documents`;

/** Firestore document IDs can't contain "/" and must be at most 1500 bytes. */
export function docId(id) {
  const s = String(id);
  return /^[A-Za-z0-9_\-.:@]{1,200}$/.test(s) && s !== '.' && s !== '..' ? s : 'h_' + crypto.createHash('sha256').update(s).digest('hex').slice(0, 40);
}

async function call(method, url, body) {
  const token = await accessToken();
  const r = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let j = {};
  try { j = text ? JSON.parse(text) : {}; } catch { j = { raw: text }; }
  if (!r.ok) throw new Error(`Firestore ${r.status}: ${j.error?.message || text.slice(0, 200)}`);
  return j;
}

/** Every record of one collection, in the order they were first saved. */
export async function loadCollection(name) {
  const out = [];
  let pageToken = '';
  do {
    const u = new URL(`${base()}/${root()}/te_${name}`);
    u.searchParams.set('pageSize', '300');
    if (pageToken) u.searchParams.set('pageToken', pageToken);
    const j = await call('GET', u.toString());
    for (const d of j.documents || []) {
      const json = d.fields?.j?.stringValue;
      if (!json) continue;
      try { out.push({ rec: JSON.parse(json), json, seq: Number(d.fields?.s?.integerValue || 0) }); } catch {}
    }
    pageToken = j.nextPageToken || '';
  } while (pageToken);
  out.sort((a, b) => a.seq - b.seq);
  return out;
}

/** Saves and deletes in batches (Firestore allows 500 writes per commit). */
export async function commit(writes) {
  for (let i = 0; i < writes.length; i += 450) {
    const chunk = writes.slice(i, i + 450).map(w => {
      const name = `${root()}/te_${w.collection}/${docId(w.id)}`;
      return w.delete ? { delete: name } : { update: { name, fields: { j: { stringValue: w.json }, s: { integerValue: String(w.seq) } } } };
    });
    await call('POST', `${base()}/${root()}:commit`, { writes: chunk });
  }
}
