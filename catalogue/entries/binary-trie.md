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
---

Keys only in the leaves, internal nodes branching on bits: the shape is independent of insertion order.

Keys are w-bit integers; bit d of the search key, counted from the most significant, picks the link at depth d. Internal nodes, drawn small and hollow, hold no key, and a key sits in a leaf as soon as it is alone in its subtree; two keys that share a long prefix are separated by a chain of one-way branches.

The trie depends only on the set of keys and never on their order, which the harness checks by building it from two orders. Clustered keys share their leading bits and produce exactly the one-way chains that Patricia removes.
