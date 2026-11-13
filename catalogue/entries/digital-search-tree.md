---
id: digital-search-tree
title: Digital search tree
taxonomy: searching/radix-search
status: live
engine: tree
sources:
  - id: sedgewick-aic
    ref: "Part 4: Searching"
tags:
  - radix search
  - bits
  - trees
complexity: at most w + 1 nodes per search for w-bit keys, about lg n on random keys
related:
  - bst-search-insert
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites:
  - bst-search-insert
  objectives:
  - Branch on bit d of the search key at depth d, with a full comparison at each node.
  - See why no path is longer than the key width, whatever the insertion order.
  misconceptions:
  - Reading a digital search tree in order gives the keys sorted; it does not, the keys of a subtree only share the bits of the path to it.
algorithm:
  paradigm: search
bounds:
  model: nodes touched
  worst: at most w + 1 per search for w-bit keys, whatever the insertion order
claims:
  - id: default-width-height-bound
    statement: >-
      With no extra key bits the 24 keys are w = max(4, ⌈lg 96⌉) = 7 bits wide and the tree is at
      most w + 1 = 8 levels high, a hard bound: a key at depth d agrees with its path on its first
      d bits, so only the key itself could sit at depth w and nothing sits deeper.
    readout: Height
    expect: { below: 9 }
  - id: six-extra-bits-height-bound
    statement: >-
      With 6 extra key bits (w = 13) the bound rises to w + 1 = 14 levels, a hard bound from the
      same argument; ascending input still builds no path, the bound being the width, not n.
    readout: Height
    expect: { below: 15 }
    setup:
      params: { shape: ascending, spare: 6 }
---

Branch on the key's bits, one per level, with keys stored in the internal nodes.

Each node holds a key, as in a search tree, but the direction taken at depth d is bit d of the search key, and at each node one full comparison checks whether the key has been found. In-order is not sorted, but every key in a subtree shares the bits of the path to it, which the harness checks.

No path is longer than the key width, whatever the insertion order, so ascending input does not build a path the way it does for a plain search tree.
