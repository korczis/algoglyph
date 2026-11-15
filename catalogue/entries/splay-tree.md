---
id: splay-tree
title: Splay tree
taxonomy: searching/balanced-trees
status: live
engine: tree
labs:
  - search-trees
sources:
  - id: sedgewick-aic
    ref: "Part 4: Searching"
tags:
  - splay
  - self-adjusting
  - amortised
complexity: amortised lg n per operation
related:
  - bst-root-insertion
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites:
  - bst-rotations
  objectives:
  - Bring every accessed key to the root two levels at a time, by zig-zig and zig-zag steps.
  - See why one operation can be slow while any sequence costs O(lg n) per operation.
algorithm:
  paradigm: search
bounds:
  model: key comparisons
  worst: amortised O(lg n) per operation over any sequence of operations
claims:
  - id: ascending-rotations
    statement: >-
      With 31 ascending keys every insertion finds the largest key already at the root and rotates
      nothing; all 101 rotations of the run come from splaying the 15 searches of the default seed,
      recomputed by an independent bottom-up splay tree.
    readout: Rotations
    expect: { value: 101 }
    setup:
      params: { shape: ascending }
  - id: ascending-height
    statement: >-
      After 31 ascending insertions (a path) and the default seed's 15 searches the splay tree is 9
      levels high, levels, counting the nodes on the longest root-to-leaf path (a single node is 1),
      recomputed by an independent splay tree.
    readout: Height
    expect: { value: 9 }
    setup:
      params: { shape: ascending }
  - id: random-order-comparisons
    statement: >-
      With the 31 keys in the default seed's random order the run makes 299 key comparisons,
      splaying and the one comparison at the root included, recomputed by an independent splay tree.
    readout: Key comparisons
    expect: { value: 299 }
    setup:
      params: { shape: random }
---

Every access rotates the key to the root in pairs, which halves the path depth on the way.

A splay moves the accessed key up two levels at a time. When the key, its parent and its grandparent lie on a straight line the grandparent is rotated first (zig-zig); when they zig-zag the parent is rotated first; a final single rotation finishes at the root. An insertion splays the nearest key to the root and splits the tree around the new one.

One operation can be slow, a search down a long path costs a comparison per level, but the zig-zig step roughly halves the depth of every node on that path, and over any sequence of operations the cost is O(lg n) each. Keys accessed recently stay near the root; the tests check that every access leaves the key it found at the root.
