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
related:
  - multiway-trie
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites:
  - multiway-trie
  objectives:
  - Follow the less and greater links at the same key position and the equal link to the next one.
  - See why three links per node replace one per letter of the alphabet.
claims:
  - id: three-letters-every-word-held
    statement: >-
      Over an alphabet of R = 3 letters the trie holds exactly the 20 words drawn: three letters
      spell 363 words of 1 to 5 letters (3 + 9 + 27 + 81 + 243), so the draw reaches 20 distinct
      words, and each one ends at its own marked node.
    readout: Keys held
    expect: { value: 20 }
    setup:
      params: { letters: 3 }
  - id: three-letters-height-bound
    statement: >-
      Over R = 3 letters the trie is at most 15 levels high, a hard bound: at each of a word's at
      most 5 positions a path crosses a search tree of the distinct letters there, at most R = 3
      nodes, before its equal link moves on, so at most R · 5 = 15 levels.
    readout: Height
    expect: { below: 16 }
    setup:
      params: { letters: 3 }
  - id: ten-letters-every-word-held
    statement: >-
      Over R = 10 letters the trie still holds exactly the 20 words drawn, one marked node each: a
      larger alphabet only widens the search tree at each position.
    readout: Keys held
    expect: { value: 20 }
    setup:
      params: { letters: 10 }
---

One character per node with less, equal and greater links: a trie as compact as a search tree.

Each node holds one character. A smaller character follows the left link and a larger one the right, both staying at the same position in the key; an equal character goes down the middle link to the next position. Filled nodes end a word.

The left and right links form a small search tree of the characters met at each position, so a node needs three links instead of one per letter. The harness checks that order and that the words read back from the trie are exactly the words inserted.
