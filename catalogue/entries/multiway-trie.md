---
id: multiway-trie
title: Multiway trie
taxonomy: searching/radix-search
status: live
engine: tree
sources:
  - id: sedgewick-aic
    ref: "Part 4: Searching"
tags:
  - trie
  - strings
  - r-way
complexity: one character test per character of the key; R links per node
related:
  - ternary-search-trie
  - binary-trie
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
  - Follow one link per character, one level per character of the key, with no key comparisons.
  - Weigh the speed against the memory of a link reserved for every letter in every node.
algorithm:
  paradigm: search
bounds:
  model: character tests
  worst: one per character of the search key, and no key comparisons
---

R links per node, one per character, fast and generous with memory.

The words are drawn from a small alphabet so that prefixes are shared. Each node has one link per letter, most of them empty, and a filled node marks the end of a word. A search reads one character per level and never compares keys.

Memory is the price: every node reserves a link for each letter of the alphabet, used or not, while the ternary search trie keeps only the links that exist.
