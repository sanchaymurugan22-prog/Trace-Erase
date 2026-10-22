// The app's database. Records live in memory for speed, and every change is saved to storage:
//   - Firestore, when FIREBASE_SERVICE_ACCOUNT is set (the online version), or
//   - server/data/db.json (on your computer).
// Firestore saves are batched: about a second after changes, only the records that changed are written.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from './config.js';
import { serviceAccount } from './util/google.js';
import * as firestore from './store/firestore.js';

const COLLECTIONS = [
  'users', 'otps', 'passkeys', 'challenges', 'addresses', 'companies', 'holdings', 'scans',
  'policies', 'requests', 'targets', 'receipts', 'batches', 'messages', 'alerts', 'evidence',
  'complaints', 'certificates', 'chats', 'outbox', 'staff', 'i18n',
  'aiLog', 'meta', 'leaks', 'chatsIndex'
];
// Short-lived collections that don't need to survive a restart
const VOLATILE = new Set(['challenges']);
// Keep these logs from growing forever
const CAPS = { aiLog: 300 };

export const storage = serviceAccount() ? 'firestore' : 'file';
const file = path.join(config.dataDir, 'db.json');
let data = {};
let timer = null;

// Firestore bookkeeping: what each record looked like when it was last saved
const saved = {};          // collection -> Map(id -> { json, seq })
let seqCounter = 0;
const nextSeq = () => Date.now() * 1000 + (seqCounter = (seqCounter + 1) % 1000);
let flushing = null;
let dirtyWhileFlushing = false;
export const storageStatus = { storage, loadedAt: null, lastSaveAt: null, lastError: null, writes: 0 };

async function loadFirestore() {
  for (const c of COLLECTIONS) {
    data[c] = [];
    saved[c] = new Map();
    if (VOLATILE.has(c)) continue;
    const rows = await firestore.loadCollection(c);
    for (const r of rows) { data[c].push(r.rec); saved[c].set(r.rec.id, { json: r.json, seq: r.seq }); }
  }
}

function loadFile() {
  fs.mkdirSync(config.dataDir, { recursive: true });
  if (fs.existsSync(file)) {
    try { data = JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch (e) {
      const bad = file + '.corrupt-' + Date.now();
      fs.copyFileSync(file, bad);
      console.error('[db] Could not read db.json, saved a copy to', bad);
      data = {};
    }
  }
  for (const c of COLLECTIONS) if (!Array.isArray(data[c])) data[c] = [];
}

/** Writes only what changed since the last save. */
async function flushFirestore() {
  const writes = [];
  const after = [];
  for (const c of COLLECTIONS) {
    if (VOLATILE.has(c)) continue;
    const prev = saved[c];
    const seen = new Set();
    for (const r of data[c]) {
      seen.add(r.id);
      const json = JSON.stringify(r);
      const old = prev.get(r.id);
      if (old && old.json === json) continue;
      if (json.length > 950_000) { console.warn(`[db] ${c}/${r.id} is too large to save (${json.length} bytes)`); continue; }
      const seq = old?.seq || nextSeq();
      writes.push({ collection: c, id: r.id, json, seq });
      after.push(() => prev.set(r.id, { json, seq }));
    }
    for (const id of prev.keys()) if (!seen.has(id)) { writes.push({ collection: c, id, delete: true }); after.push(() => prev.delete(id)); }
  }
  if (!writes.length) return;
  await firestore.commit(writes);
  for (const f of after) f();
  storageStatus.lastSaveAt = new Date().toISOString();
  storageStatus.writes += writes.length;
  storageStatus.lastError = null;
}

function flushFile() {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 1));
  fs.renameSync(tmp, file);
}

async function flush() {
  timer = null;
  if (storage === 'file') return flushFile();
  if (flushing) { dirtyWhileFlushing = true; return flushing; }
  flushing = (async () => {
    try { await flushFirestore(); }
    catch (e) {
      storageStatus.lastError = e.message;
      console.error('[db] Saving to Firestore failed, will retry:', e.message);
      setTimeout(save, 5000);
    } finally {
      flushing = null;
      if (dirtyWhileFlushing) { dirtyWhileFlushing = false; save(); }
    }
  })();
  return flushing;
}

export function save() {
  if (!timer) timer = setTimeout(flush, storage === 'file' ? 150 : 800);
}
/** Save right away (before shutting down, or in tests). */
export async function saveNow() { if (timer) { clearTimeout(timer); timer = null; } await flush(); if (flushing) await flushing; }

export const id = (prefix = '') => prefix + crypto.randomBytes(8).toString('hex');

export const db = {
  all: (c) => data[c],
  get: (c, recId) => data[c].find(r => r.id === recId) || null,
  find: (c, pred) => data[c].find(pred) || null,
  filter: (c, pred) => data[c].filter(pred),
  insert(c, rec) {
    const r = { id: rec.id || id(), createdAt: rec.createdAt || new Date().toISOString(), ...rec };
    data[c].push(r);
    if (CAPS[c] && data[c].length > CAPS[c]) data[c].splice(0, data[c].length - CAPS[c]);
    save();
    return r;
  },
  update(c, recId, patch) {
    const r = data[c].find(x => x.id === recId);
    if (!r) return null;
    Object.assign(r, typeof patch === 'function' ? patch(r) || {} : patch, { updatedAt: new Date().toISOString() });
    save();
    return r;
  },
  remove(c, pred) {
    const before = data[c].length;
    data[c] = data[c].filter(r => !pred(r));
    if (data[c].length !== before) save();
    return before - data[c].length;
  },
  reset() { for (const cc of COLLECTIONS) data[cc] = []; save(); }
};

// Load everything before the rest of the server starts (top-level await)
if (storage === 'firestore') {
  try { await loadFirestore(); }
  catch (e) {
    console.error('\n  Could not load data from Firestore:', e.message, '\n  Check FIREBASE_SERVICE_ACCOUNT and that Firestore is created in the Firebase console.\n');
    process.exit(1);
  }
} else loadFile();
storageStatus.loadedAt = new Date().toISOString();

const shutdown = async (code) => { try { await saveNow(); } catch {} process.exit(code); };
process.on('exit', () => { if (timer && storage === 'file') flushFile(); });
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
