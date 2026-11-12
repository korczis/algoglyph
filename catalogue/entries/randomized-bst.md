---
id: randomized-bst
title: Randomized binary search tree
taxonomy: searching/balanced-trees
status: live
engine: tree
labs:
  - search-trees
sources:
  - id: sedgewick-aic
    ref: "Part 4: Searching"
tags:
  - randomized
  - balanced trees
  - root insertion
complexity: about 1.39 lg n expected compares per search, whatever the input order
related:
  - bst-root-insertion
  - bst-delete-join
  - splay-tree
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites:
  - bst-root-insertion
  objectives:
  - Make a new key the root of a subtree of size s with probability 1/(s+1), by root insertion.
  - See why the tree is distributed like one built from a random permutation, even on ascending input.
  - Join two subtrees on deletion choosing either root in proportion to its size.
algorithm:
  paradigm: randomized
claims:
  - id: no-deletes-keeps-every-key
    statement: >-
      With a share deleted of 0 the tree keeps all 31 keys inserted, exactly: ⌊0 · 31⌋ = 0 keys
      are deleted; a randomized insertion still places every key once.
    readout: Keys held
    expect: { value: 31 }
    setup:
      params: { deletes: 0 }
  - id: quarter-deleted-keeps-the-rest
    statement: >-
      With a share deleted of 0.25 the tree keeps 31 − ⌊0.25 · 31⌋ = 24 keys, exactly: each of the
      7 deletions removes one present key, joining its subtrees in proportion to their sizes.
    readout: Keys held
    expect: { value: 24 }
    setup:
      params: { deletes: 0.25 }
  - id: tenth-deleted-operation-count
    statement: >-
      With a share deleted of 0.1 on ascending input the run is exactly 31 + 15 + ⌊0.1 · 31⌋ = 49
      operations, the inserts, the ⌊n / 2⌋ searches and the 3 deletions, whatever the random
      choices of the roots.
    readout: Operation
    expect: { value: 49 }
    setup:
      params: { shape: ascending, deletes: 0.1 }
---

Every insertion lands at the root with the right probability, so the tree is random whatever the order.

Each node keeps its subtree size, printed beside it when there is room. At a subtree of size s the new key becomes its root with probability 1/(s+1), by root insertion; otherwise the insertion continues down. The random draws come from the plate's seed, so the same URL rebuilds the same tree.

Because each key is equally likely to be the root of any subtree it lands in, the tree is distributed like a search tree built from a random permutation, even on ascending input. Deletion joins the two subtrees by the same rule, choosing either root in proportion to its size, so the property survives deletions; after the searches the plate deletes half the keys by default (Share deleted sets the share).
