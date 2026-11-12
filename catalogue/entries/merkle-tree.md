---
id: merkle-tree
title: Merkle tree and hash chain
taxonomy: systems/integrity
status: live
engine: systems
sources:
  - id: practice-investigation
tags:
  - merkle tree
  - hash chain
  - tamper evidence
motivation: Link analysis in investigations and due diligence leans on it.
related:
  - hash-avalanche
complexity: O(d log n) digests to find d differing blocks of n; O(n) to audit a chain of n links
---

Hashes of hashes up to one root, and a chain in which every entry seals the one before.

Replica B repairs its copy of A's blocks top-down: it asks for the root, and wherever A's digest differs from its own it asks for the two children, until it reaches the differing blocks, which alone are transferred. Matching subtrees are never descended, so the digests compared grow with the number of differences times the depth, not with the number of blocks.

Hashes are SHA-256 of one 32-byte block. A leaf hashes a tagged record with its index; a parent hashes the first 128 bits of each child's digest side by side, so it fits one block, at the cost of collision resistance: a 128-bit digest resists collisions to about 2^64 work, not 2^128. The harness checks the digests against an independent SHA-256, that changing any leaf moves the root, and that every inclusion proof verifies.

A's log is a hash chain: each link hashes the previous link with its payload, and A reports every new head to an auditor, which anchors it. Editing one entry breaks the next recomputation, found at that entry. Editing it and recomputing every later link leaves a chain that is consistent on its own, which the anchored heads expose: the auditor's earlier digest no longer matches.
