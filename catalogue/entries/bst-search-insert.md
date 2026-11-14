---
id: bst-search-insert
title: Binary search tree
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
  - symbol table
complexity: about 1.39 lg n compares per search on random keys, n in the worst case
related:
  - red-black-tree
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  objectives:
  - Search and insert by comparing down from the root, a new key hanging where the search fell off.
  - See that the shape is the insertion order, a path of n levels on ascending or descending keys.
algorithm:
  paradigm: search
bounds:
  model: key comparisons
  average: about 2 ln n, roughly 1.39 lg n, per search on random keys
  worst: n per search, on the path of n levels that ascending or descending keys build
claims:
  - id: ascending-keys-build-a-path
    statement: >-
      With 31 keys arriving in ascending order each one hangs to the right of the one before, so the
      tree is a path: Height is exactly 31 levels, counting the nodes on the longest root-to-leaf
      path (a single node is 1).
    readout: Height
    expect: { value: 31 }
    setup:
      params: { shape: ascending }
  - id: ascending-comparisons
    statement: >-
      With 31 ascending keys the i-th insertion compares with all i − 1 keys on the path, 0 + 1 + …
      + 30 = 465 comparisons; the 15 searches of the default seed take 233 more along that path, 698
      in all, recomputed by an independent binary search tree.
    readout: Key comparisons
    expect: { value: 698 }
    setup:
      params: { shape: ascending }
  - id: random-order-height
    statement: >-
      With the 31 keys in the default seed's random order the tree is 9 levels high, recomputed by
      an independent binary search tree; height is in levels, counting the nodes on the longest
      root-to-leaf path (a single node is 1).
    readout: Height
    expect: { value: 9 }
    setup:
      params: { shape: random }
---

Search and insert by comparing down from the root; the shape is the insertion order.

A search compares the key with the root and goes left or right until it finds the key or falls off the tree; an insertion is the same search ending with a new leaf where it fell off. The highlighted path is the current operation's, and every comparison and node touched is counted.

On a random order the average search costs about 2 ln n, roughly 1.39 lg n, comparisons. Ascending or descending keys build a path of n levels instead, which the height curve against lg(n+1) makes plain.
