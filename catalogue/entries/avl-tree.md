---
id: avl-tree
title: AVL tree
taxonomy: searching/balanced-trees
status: live
engine: tree
labs:
  - search-trees
sources:
  - id: knuth-taocp-3
tags:
  - balanced trees
  - rotations
  - height
complexity: height below 1.44 lg n; lg n per insert and search
related:
  - red-black-tree
  - bst-rotations
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites:
  - bst-rotations
  objectives:
  - Keep the heights of every node's subtrees within one, recomputing them on the way back up.
  - Choose a single rotation for an outside heavy grandchild and a double one for an inside one.
  - See why a Fibonacci number of nodes per height keeps the height below about 1.44 lg n.
bounds:
  model: levels
  worst: below about 1.44 lg n
claims:
  - id: ascending-keys-fill-a-perfect-tree
    statement: >-
      With 31 = 2^5 − 1 ascending keys the AVL tree ends perfect: Height is exactly 5 levels,
      counting the nodes on the longest root-to-leaf path (a single node is 1).
    readout: Height
    expect: { value: 5 }
    setup:
      params: { shape: ascending }
  - id: ascending-rotations
    statement: >-
      With 31 ascending keys the i-th insertion makes one single rotation exactly when i is not a
      power of two, so the run makes 31 − 5 = 26 rotations (a double rotation would count two;
      ascending keys never need one).
    readout: Rotations
    expect: { value: 26 }
    setup:
      params: { shape: ascending }
  - id: random-order-rotations
    statement: >-
      With the 31 keys in the default seed's random order the insertions make 16 rotations, a double
      rotation counted as two, recomputed by an independent AVL tree.
    readout: Rotations
    expect: { value: 16 }
    setup:
      params: { shape: random }
---

Keep the heights of every node's subtrees within one, with single and double rotations.

Each node keeps the height of its subtree, printed beside it when the nodes are large enough. After an insertion the heights are recomputed on the way back up; a node whose subtrees differ by two is rotated once when the heavy grandchild is on the outside and twice when it is on the inside, which restores the subtree's old height.

A tree whose subtrees differ in height by at most one has at least a Fibonacci number of nodes for its height, so the height stays below about 1.44 lg n. The test harness checks the balance condition at every node, and the bound on ascending, zig-zag and random input.
