---
id: binary-trie
title: Binary trie
taxonomy: searching/radix-search
status: live
engine: tree
sources:
  - id: sedgewick-aic
    ref: "Part 4: Searching"
tags:
  - trie
  - radix search
  - bits
complexity: about lg n bit tests per search on random keys, at most the key width
related:
  - digital-search-tree
  - patricia-trie
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
  - Branch on bit d of the key at depth d, with keys only in the leaves.
  - See that the trie depends only on the set of keys, and why shared prefixes make one-way chains.
algorithm:
  paradigm: search
bounds:
  model: bit tests
  worst: at most w per search for w-bit keys
claims:
  - id: clustered-three-extra-bits-height-exact
    statement: >-
      On the clustered input with 3 extra key bits the 24 keys are w = max(4, ⌈lg 96⌉) + 3 = 10
      bits wide and the trie is exactly 11 levels high: the 24 keys are four whole blocks of 6
      consecutive integers, each block holds a pair 2j, 2j + 1 that differs only in its last bit,
      so that pair's leaves sit at depth w, and no leaf can sit deeper, internal nodes branching
      only on bits 0 to w − 1.
    readout: Height
    expect: { value: 11 }
    setup:
      params: { shape: clustered, spare: 3 }
  - id: clustered-six-extra-bits-height-exact
    statement: >-
      With 6 extra key bits the clustered keys are w = 7 + 6 = 13 bits wide and the trie is exactly
      w + 1 = 14 levels high, by the same pair of consecutive keys that differ only in the last bit:
      each extra bit adds exactly one level to their shared one-way chain.
    readout: Height
    expect: { value: 14 }
    setup:
      params: { shape: clustered, spare: 6 }
  - id: random-six-extra-bits-height-bound
    statement: >-
      On random keys with 6 extra key bits (w = 13) the trie is at most w + 1 = 14 levels high, a
      hard bound: an internal node at depth d branches on bit d, so a leaf sits at depth w at most.
    readout: Height
    expect: { below: 15 }
    setup:
      params: { spare: 6 }
---

Keys only in the leaves, internal nodes branching on bits: the shape is independent of insertion order.

Keys are w-bit integers; bit d of the search key, counted from the most significant, picks the link at depth d. Internal nodes, drawn small and hollow, hold no key, and a key sits in a leaf as soon as it is alone in its subtree; two keys that share a long prefix are separated by a chain of one-way branches.

The trie depends only on the set of keys and never on their order, which the harness checks by building it from two orders. Clustered keys share their leading bits and produce exactly the one-way chains that Patricia removes.
