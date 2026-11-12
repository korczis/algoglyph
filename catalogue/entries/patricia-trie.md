---
id: patricia-trie
title: Patricia trie
taxonomy: searching/radix-search
status: live
engine: tree
sources:
  - id: sedgewick-aic
    ref: "Part 4: Searching"
tags:
  - patricia
  - trie
  - radix search
complexity: about lg n bit tests and one full comparison per search
related:
  - binary-trie
  - digital-search-tree
---

A trie that skips the bits where nothing branches, with exactly one node per key.

Each node holds one key and the index of the bit it tests, printed beside it. The root is a header holding the first key; links that point down lead to a larger bit index, and the rest, drawn as faint curves, point back up to the node whose key ends the search. A search follows links while the bit index grows, then makes one full comparison.

An insertion searches first, finds the first bit where the new key differs from the key it landed on, and splices a node testing that bit into the path. One-way branching never appears, so n keys take exactly n nodes; the harness checks that count and that every key is found by an independent search.
