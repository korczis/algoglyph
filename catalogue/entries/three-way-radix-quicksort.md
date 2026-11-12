---
id: three-way-radix-quicksort
title: Three-way radix quicksort
taxonomy: sorting/radix
status: live
engine: string
sources:
  - id: sedgewick-aic
    ref: "Part 3: Sorting"
tags:
  - sorting
  - strings
  - radix
  - partitioning
complexity: "about 2 n ln n character comparisons for random strings; linear in the characters examined for long shared prefixes"
related:
  - quicksort-three-way
  - ternary-search-trie
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites: [quicksort-three-way, msd-radix-sort]
  objectives:
  - 'Count a partition: m strings cost exactly m − 1 character comparisons, one for every string after the first, whatever the characters are.'
  - 'Read the Swaps against the Character comparisons: never more swaps, since a comparison triggers at most one.'
  - 'Explain why the equal band moves on to the next character without comparing the shared prefix again.'
  misconceptions:
  - 'Strings with long shared prefixes make each partition dearer; every partition of m strings costs m − 1 character comparisons, and the shared prefixes cost more partitions, not dearer ones.'
algorithm:
  paradigm: divide-and-conquer
bounds:
  model: 'character comparisons and swaps (the plate''s two counters)'
  average: 'every partition of m strings exactly m − 1 character comparisons and at most m − 1 swaps, the first one n − 1; so the Character comparisons are the sum of m − 1 over the partitions, and the Swaps never exceed them'
---

Partition strings into less, equal and greater on one character, then recurse on the next.

The highlighted column is the character the current range is partitioned on, taken from the first string of the range. Strings with a smaller character move up, larger ones move down, and equal ones stay in the middle band, which is then sorted on the next character; a string that has ended counts as smaller than any character, so it sorts before its extensions.

The input draws words from a few stems with suffixes, so many strings share prefixes: the equal band carries them past the shared characters without comparing those characters again.
