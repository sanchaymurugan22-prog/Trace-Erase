# On-chain anchoring (optional)

By default TraceErase anchors every batch of receipt fingerprints in its own **hash-chained ledger**
(each batch's Merkle root is chained to the previous one, so any edit is detectable).

To also anchor on a public blockchain:

1. Deploy `TraceAnchor.sol` to **Polygon Amoy** (free testnet) with Remix (remix.ethereum.org):
   compile with Solidity 0.8.24, connect MetaMask on Amoy, deploy, copy the contract address.
2. Get test POL from a Polygon Amoy faucet for the deploying wallet.
3. In `server/.env` set:
   ```
   ANCHOR_RPC_URL=https://rpc-amoy.polygon.technology
   ANCHOR_PRIVATE_KEY=<the deploying wallet's private key, testnet only>
   ANCHOR_CONTRACT=<deployed address>
   ```
4. Restart. Each batch now also sends `anchor(root, batch)`; the transaction hash appears on receipts.

Only 32-byte fingerprints go on-chain. Never put a mainnet key with real funds in `.env`.
