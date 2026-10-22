// Receipt ledger: every receipt gets a SHA-256 fingerprint; fingerprints are bundled into
// Merkle batches. Each batch root is chained to the previous one (tamper-evident) and, if
// configured, anchored on a real blockchain (e.g. Polygon Amoy) through a tiny contract.
import { db } from '../db.js';
import { config } from '../config.js';
import { sha256, merkleRoot, merkleProof, verifyProof, stableStringify } from '../util/crypto.js';
import { nowIso } from './clock.js';

/**
 * Record a receipt.
 * kind: share | deletion | request-signature | evidence | consent | complaint | certificate | message
 */
export function addReceipt({ userId = null, companyId = null, kind, title, data, signedBy }) {
  const body = { kind, title, data, signedBy, issuedAt: nowIso() };
  const hash = sha256(stableStringify(body));
  return db.insert('receipts', { userId, companyId, ...body, hash, batchId: null, status: 'pending' });
}

let anchoring = false;
export async function runBatch() {
  if (anchoring) return null;
  const pending = db.filter('receipts', r => !r.batchId);
  if (!pending.length) return null;
  anchoring = true;
  try {
    const leaves = pending.map(r => r.hash);
    const root = merkleRoot(leaves);
    const prev = db.all('batches').at(-1);
    const number = (prev?.number || 0) + 1;
    const chainHash = sha256(`${prev?.chainHash || '0x0'}|${root}|${number}`);
    const batch = db.insert('batches', {
      number, root, leaves, chainHash, prevChainHash: prev?.chainHash || null, size: leaves.length,
      anchoredAt: nowIso(), network: 'TraceErase local ledger', txHash: null
    });
    for (const r of pending) db.update('receipts', r.id, { batchId: batch.id, status: 'anchored' });
    anchorOnChain(batch).catch(e => console.warn('[ledger] on-chain anchoring failed:', e.message));
    return batch;
  } finally { anchoring = false; }
}

async function anchorOnChain(batch) {
  const { rpcUrl, privateKey, contract, network } = config.chain;
  if (!rpcUrl || !privateKey || !contract) return;
  const { ethers } = await import('ethers');
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const c = new ethers.Contract(contract, ['function anchor(bytes32 root, uint256 batch) external'], wallet);
  const tx = await c.anchor(batch.root, batch.number);
  db.update('batches', batch.id, { network, txHash: tx.hash });
  await tx.wait();
  db.update('batches', batch.id, { onChainConfirmed: true });
}

export function verifyReceipt(receiptId) {
  const r = db.get('receipts', receiptId);
  if (!r) return { found: false };
  const recomputed = sha256(stableStringify({ kind: r.kind, title: r.title, data: r.data, signedBy: r.signedBy, issuedAt: r.issuedAt }));
  const intact = recomputed === r.hash;
  if (!r.batchId) return { found: true, intact, anchored: false, receipt: publicReceipt(r) };
  const b = db.get('batches', r.batchId);
  const proof = merkleProof(b.leaves, r.hash);
  const inBatch = !!proof && verifyProof(r.hash, proof, b.root);
  // check the chain of batch roots up to this batch
  const all = db.all('batches');
  let prev = '0x0', chainOk = true;
  for (const x of all) {
    if (sha256(`${prev}|${x.root}|${x.number}`) !== x.chainHash) { chainOk = false; break; }
    prev = x.chainHash;
    if (x.id === b.id) break;
  }
  return {
    found: true, intact, anchored: true, inBatch, chainOk,
    valid: intact && inBatch && chainOk,
    receipt: publicReceipt(r),
    batch: { number: b.number, root: b.root, size: b.size, anchoredAt: b.anchoredAt, network: b.network, txHash: b.txHash, chainHash: b.chainHash },
    proof
  };
}

export const publicReceipt = (r) => ({ id: r.id, kind: r.kind, title: r.title, hash: r.hash, issuedAt: r.issuedAt, status: r.status, batchId: r.batchId });

let timer;
export function startLedger() {
  clearInterval(timer);
  timer = setInterval(() => runBatch().catch(e => console.error('[ledger]', e)), config.batchIntervalSec * 1000);
}
