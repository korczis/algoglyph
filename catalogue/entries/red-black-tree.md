---
id: red-black-tree
title: Red-black tree
taxonomy: searching/balanced-trees
status: live
engine: tree
labs:
  - search-trees
sources:
  - id: sedgewick-aic
    ref: "Part 4: Searching"
tags:
  - balanced trees
  - red-black
  - rotations
complexity: height at most 2 lg n; lg n per insert and search
related:
  - two-three-four-tree
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites:
  - two-three-four-tree
  - bst-rotations
  objectives:
  - Encode 3-nodes and 4-nodes of a 2-3-4 tree as red links glued to their parents.
  - Split 4-nodes on the way down by flipping colours, and rotate red links on the way up.
  - See why equal black heights with no two reds in a row keep every path within twice another.
bounds:
  model: levels
  worst: at most 2 lg(n+1)
claims:
  - id: ascending-height
    statement: >-
      With 31 ascending keys the left-leaning red-black tree is 5 levels high, levels, counting the
      nodes on the longest root-to-leaf path (a single node is 1), recomputed by an independent
      left-leaning red-black tree.
    readout: Height
    expect: { value: 5 }
    setup:
      params: { shape: ascending }
  - id: ascending-rotations
    statement: >-
      With 31 ascending keys the insertions make 26 rotations, recomputed by an independent
      left-leaning red-black tree (Sedgewick's 2-3-4 form: flip on the way down, rotate on the way
      up).
    readout: Rotations
    expect: { value: 26 }
    setup:
      params: { shape: ascending }
  - id: ascending-recolourings
    statement: >-
      With 31 ascending keys 122 nodes change colour over the run, counting only actual changes (a
      new node is born red), recomputed by an independent left-leaning red-black tree.
    readout: Recolourings
    expect: { value: 122 }
    setup:
      params: { shape: ascending }
---

A binary tree that encodes 2-3-4 nodes with red links and stays within 2 lg n deep.

A red node is glued to its parent: together they form a 3-node or, with a red sibling, a 4-node of a 2-3-4 tree. This kernel is the left-leaning variant: on the way down a 4-node is split by flipping three colours, and on the way up a right-leaning red link is rotated left and two reds in a row are rotated right. Red links are drawn thick.

Every path from the root to an empty link crosses the same number of black nodes and no two red nodes touch, so no path is more than twice as long as another. The test harness checks both properties on every input, and the height bound on ascending, descending and random keys.
