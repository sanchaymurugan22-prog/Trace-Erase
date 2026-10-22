// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title TraceAnchor
/// @notice Stores one Merkle root per batch of TraceErase receipts. Only fingerprints, never personal data.
/// Deploy to Polygon Amoy (testnet), then set ANCHOR_RPC_URL, ANCHOR_PRIVATE_KEY and ANCHOR_CONTRACT in server/.env.
contract TraceAnchor {
    address public immutable owner;
    mapping(uint256 => bytes32) public roots;
    mapping(uint256 => uint256) public anchoredAt;

    event Anchored(uint256 indexed batch, bytes32 root, uint256 timestamp);

    constructor() { owner = msg.sender; }

    function anchor(bytes32 root, uint256 batch) external {
        require(msg.sender == owner, "only owner");
        require(roots[batch] == bytes32(0), "batch already anchored");
        roots[batch] = root;
        anchoredAt[batch] = block.timestamp;
        emit Anchored(batch, root, block.timestamp);
    }

    /// @notice Verify that a receipt fingerprint belongs to an anchored batch (sorted-pair SHA-256 Merkle proof).
    function verify(uint256 batch, bytes32 leaf, bytes32[] calldata proof) external view returns (bool) {
        bytes32 h = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 p = proof[i];
            h = h < p ? sha256(abi.encodePacked(h, p)) : sha256(abi.encodePacked(p, h));
        }
        return h == roots[batch];
    }
}
