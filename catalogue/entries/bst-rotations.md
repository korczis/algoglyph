---
id: bst-rotations
title: Rotations in a binary search tree
taxonomy: searching/binary-trees
status: live
engine: tree
sources:
  - id: sedgewick-aic
    ref: "Part 4: Searching"
tags:
  - binary search tree
  - rotations
  - rebalancing
complexity: one rotation changes two links in constant time and keeps the in-order
related:
  - red-black-tree
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites:
  - bst-search-insert
  objectives:
  - Rotate a parent and child with two link changes while every key keeps its in-order position.
  - Rebalance a tree by rotating the median to the root by rank, then each subtree the same way.
bounds:
  model: levels
  worst: ⌈lg(n+1)⌉ after balancing, the minimal height, whatever the arrival order
claims:
  - id: random-order-balances-to-five-levels
    statement: >-
      Rotating the median of every subtree to its root (rank ⌊size / 2⌋) leaves 31 = 2^5 − 1 keys in
      a perfect tree: Height is exactly 5 levels, counting the nodes on the longest root-to-leaf
      path (a single node is 1), whatever order the keys arrived in.
    readout: Height
    expect: { value: 5 }
    setup:
      params: { shape: random }
  - id: ascending-balancing-rotations
    statement: >-
      With 31 ascending keys the path is rebalanced by exactly 49 rotations, recomputed by an
      independent median rebalancing written in the test.
    readout: Rotations
    expect: { value: 49 }
    setup:
      params: { shape: ascending }
  - id: random-order-balancing-rotations
    statement: >-
      With the 31 keys in the default seed's random order the rebalancing makes 33 rotations,
      recomputed by an independent median rebalancing written in the test.
    readout: Rotations
    expect: { value: 33 }
    setup:
      params: { shape: random }
---

A rotation exchanges a parent and child and keeps the order, the move every balanced tree is built from.

A right rotation at a node lifts its left child: the child's right subtree becomes the node's left, and the node becomes the child's right child. Two links change, every key keeps its in-order position, and the two nodes trade levels.

The plate builds the tree in arrival order, then rebalances it: each node keeps its subtree size, the median is rotated to the root by partitioning on rank, and both subtrees are balanced the same way. The same searches run before and after, and the readouts give the cost per search for each separately; the result has the minimal height of ⌈lg(n+1)⌉ levels, which the tests check.
