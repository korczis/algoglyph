---
id: bst-root-insertion
title: Insertion at the root
taxonomy: searching/binary-trees
status: live
engine: tree
labs:
  - search-trees
sources:
  - id: sedgewick-aic
    ref: "Part 4: Searching"
tags:
  - binary search tree
  - rotations
complexity: the comparisons of a plain insertion plus one rotation per level climbed
related:
  - randomized-bst
  - bst-rotations
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites:
  - bst-search-insert
  - bst-rotations
  objectives:
  - Insert at the bottom, then rotate the new key over each ancestor until it is the root.
  - See that the result is the plain search tree of the same keys inserted in reverse order.
bounds:
  model: rotations
  worst: one per key comparison of an insertion, n − 1 when the new key lands at the bottom of a path
claims:
  - id: ascending-one-rotation-per-key
    statement: >-
      With 31 ascending keys each new key is the largest: it is compared once with the root, hung as
      its right child and rotated up once, so the run makes exactly 30 rotations, one per key after
      the first.
    readout: Rotations
    expect: { value: 30 }
    setup:
      params: { shape: ascending }
  - id: ascending-keys-build-a-path
    statement: >-
      With 31 ascending keys each new root keeps the old root as its left child, so the tree is a
      path leaning left: Height is exactly 31 levels, counting the nodes on the longest root-to-leaf
      path (a single node is 1).
    readout: Height
    expect: { value: 31 }
    setup:
      params: { shape: ascending }
  - id: random-order-rotations
    statement: >-
      With the 31 keys in the default seed's random order the insertions make 141 rotations, one for
      every node on each new key's search path, recomputed by an independent root-insertion tree.
    readout: Rotations
    expect: { value: 141 }
    setup:
      params: { shape: random }
---

Insert at the bottom, then rotate the new key up to the root.

The new key is inserted at the bottom, then rotated over each of its ancestors on the way back up, right when it came from the left and left when it came from the right, until it is the root. Keys inserted recently are found after a few comparisons.

The tree that results is exactly the plain search tree of the same keys inserted in reverse order, so on random input its shape is just as random, and ascending input still builds a path, now leaning the other way.
