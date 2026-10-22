import crypto from 'node:crypto';

export const sha256 = (input) =>
  '0x' + crypto.createHash('sha256').update(typeof input === 'string' ? input : stableStringify(input)).digest('hex');

// Deterministic JSON so the same receipt always hashes the same way.
export function stableStringify(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}';
}

const pair = (a, b) => {
  const [x, y] = [a, b].sort();
  return '0x' + crypto.createHash('sha256').update(Buffer.from(x.slice(2) + y.slice(2), 'hex')).digest('hex');
};

// Sorted-pair Merkle tree (same scheme OpenZeppelin MerkleProof uses, with sha256).
export function merkleRoot(leaves) {
  if (!leaves.length) return '0x' + '0'.repeat(64);
  let level = [...leaves];
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) next.push(i + 1 < level.length ? pair(level[i], level[i + 1]) : level[i]);
    level = next;
  }
  return level[0];
}

export function merkleProof(leaves, leaf) {
  let idx = leaves.indexOf(leaf);
  if (idx < 0) return null;
  const proof = [];
  let level = [...leaves];
  while (level.length > 1) {
    const sib = idx % 2 === 0 ? idx + 1 : idx - 1;
    if (sib < level.length) proof.push(level[sib]);
    const next = [];
    for (let i = 0; i < level.length; i += 2) next.push(i + 1 < level.length ? pair(level[i], level[i + 1]) : level[i]);
    level = next;
    idx = Math.floor(idx / 2);
  }
  return proof;
}

export function verifyProof(leaf, proof, root) {
  let h = leaf;
  for (const p of proof) h = pair(h, p);
  return h === root;
}

export const randomCode = (n = 6) => Array.from(crypto.randomBytes(n), b => (b % 10).toString()).join('');
export const randomTag = (n = 4) => {
  const a = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from(crypto.randomBytes(n), b => a[b % a.length]).join('');
};
export const short = (h, a = 6, b = 4) => (h ? `${h.slice(0, a)}…${h.slice(-b)}` : '');
