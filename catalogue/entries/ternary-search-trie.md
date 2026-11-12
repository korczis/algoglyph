---
id: ternary-search-trie
title: Ternary search trie
taxonomy: searching/radix-search
status: live
engine: tree
sources:
  - id: sedgewick-aic
    ref: "Part 4: Searching"
tags:
  - trie
  - strings
  - ternary
complexity: character comparisons in proportion to the key length plus lg n on random input
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites:
  - multiway-trie
  objectives:
  - Follow the less and greater links at the same key position and the equal link to the next one.
  - See why three links per node replace one per letter of the alphabet.
---

One character per node with less, equal and greater links: a trie as compact as a search tree.

Each node holds one character. A smaller character follows the left link and a larger one the right, both staying at the same position in the key; an equal character goes down the middle link to the next position. Filled nodes end a word.

The left and right links form a small search tree of the characters met at each position, so a node needs three links instead of one per letter. The harness checks that order and that the words read back from the trie are exactly the words inserted.
