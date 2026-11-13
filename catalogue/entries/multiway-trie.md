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
claims:
  - id: three-letters-every-word-held
    statement: >-
      Over an alphabet of R = 3 letters the trie holds exactly the 20 words drawn: three letters
      spell 3 + 9 + 27 + 81 + 243 = 363 words of 1 to 5 letters, so the draw reaches 20 distinct
      words, and each one ends at its own marked node.
    readout: Keys held
    expect: { value: 20 }
    setup:
      params: { letters: 3 }
  - id: ten-letters-present-words-found
    statement: >-
      Over R = 10 letters every present word searched for is found: the searches are ⌈20 / 4⌉ = 5
      words drawn from the trie's own and 5 absent ones, so the lookups say 5 yes, exactly.
    readout: Lookups
    expect: { value: 5 }
    setup:
      params: { letters: 10 }
  - id: ten-letters-height-bound
    statement: >-
      Over R = 10 letters the trie is at most 6 levels high, a hard bound: a random word has 1 to 5
      letters, and the root holds no letter, so the longest word is one path of at most 5 + 1
      levels whatever the alphabet; ten links per node widen the trie, never deepen it.
    readout: Height
    expect: { below: 7 }
    setup:
      params: { letters: 10 }
  - id: ten-letters-prefixes-height-bound
    statement: >-
      On the shared-prefixes input over R = 10 letters the trie is at most 11 levels high, a hard
      bound: a word there is a stem of 1 to 5 letters and a tail of 1 to 5 more, so at most 10
      letters below the root.
    readout: Height
    expect: { below: 12 }
    setup:
      params: { shape: prefixes, letters: 10 }
---

R links per node, one per character, fast and generous with memory.

The words are drawn from a small alphabet so that prefixes are shared. Each node has one link per letter, most of them empty, and a filled node marks the end of a word. A search reads one character per level and never compares keys.

Memory is the price: every node reserves a link for each letter of the alphabet, used or not, while the ternary search trie keeps only the links that exist.
