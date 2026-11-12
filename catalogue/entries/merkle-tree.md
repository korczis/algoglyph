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
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
    - Repair a replica by descending two Merkle trees top-down, never into a matching subtree, so that the digests compared grow with the number of differences times the depth, not with the number of blocks.
    - State what hashing the first 128 bits of each child costs, collision resistance to about 2^64 work rather than 2^128.
    - Tell an entry edited in place, found where the chain's recomputation breaks, from one edited with every later link recomputed, found only by the heads an auditor anchored earlier.
bounds:
  model: digests compared
  worst: O(d log n)
claims:
  - id: repair-reads-only-differing-paths
    statement: >-
      With 16 blocks (depth 4) of which 3 differ, B compares the root and the two children of
      every differing internal node, and a level l holds between ⌈3/2^(4−l)⌉ and min(3, 2^l) of
      those, so it compares between 11 and 19 digests, exactly: within differences times depth
      (1 + 2·3·4 = 25) and short of the 31 of a full comparison.
    readout: Digests compared
    expect: { range: [11, 19] }
  - id: matching-trees-compare-one-digest
    statement: >-
      When no block differs the roots match and no subtree is descended: exactly 1 digest
      compared.
    readout: Digests compared
    expect: { value: 1, tolerance: 0 }
    setup:
      params: { changed: 0 }
  - id: cost-follows-differences-not-blocks
    statement: >-
      With 64 blocks (depth 6) of which 3 differ, the same count, one root and two children per
      differing internal node with between ⌈3/2^(6−l)⌉ and min(3, 2^l) of them at level l, gives
      between 15 and 31 digests, exactly: within 1 + 2·3·6 = 37, against the 127 a full
      comparison reads.
    readout: Digests compared
    expect: { range: [15, 31] }
    setup:
      params: { depth: 6 }
  - id: only-differing-blocks-transferred
    statement: >-
      Only the differing blocks are transferred: the blocks transferred equal the number of
      differing blocks the result line reports (its second number), an identity whose difference
      is exactly 0.
    readout: Blocks transferred
    expect: { against: Result, against_number: 2, tolerance: 0 }
  - id: rewrite-found-by-anchor
    statement: >-
      An entry edited with every later link recomputed leaves a chain consistent on its own, but
      the head the auditor anchored for that entry no longer matches, so the audit finds the
      break at exactly the entry tampered with.
    readout: Audit found the break at entry
    expect: { against: Entry tampered with, tolerance: 0 }
  - id: edit-found-at-that-entry
    statement: >-
      An entry edited in place breaks the recomputation of its own link, so the audit finds the
      break at exactly the entry tampered with.
    readout: Audit found the break at entry
    expect: { against: Entry tampered with, tolerance: 0 }
    setup:
      params: { tamper: edit }
---

Hashes of hashes up to one root, and a chain in which every entry seals the one before.

Replica B repairs its copy of A's blocks top-down: it asks for the root, and wherever A's digest differs from its own it asks for the two children, until it reaches the differing blocks, which alone are transferred. Matching subtrees are never descended, so the digests compared grow with the number of differences times the depth, not with the number of blocks.

Hashes are SHA-256 of one 32-byte block. A leaf hashes a tagged record with its index; a parent hashes the first 128 bits of each child's digest side by side, so it fits one block, at the cost of collision resistance: a 128-bit digest resists collisions to about 2^64 work, not 2^128. The harness checks the digests against an independent SHA-256, that changing any leaf moves the root, and that every inclusion proof verifies.

A's log is a hash chain: each link hashes the previous link with its payload, and A reports every new head to an auditor, which anchors it. Editing one entry breaks the next recomputation, found at that entry. Editing it and recomputing every later link leaves a chain that is consistent on its own, which the anchored heads expose: the auditor's earlier digest no longer matches.
