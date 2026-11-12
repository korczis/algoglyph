---
id: longest-common-subsequence
title: Longest common subsequence
taxonomy: foundations/dynamic-programming
status: live
engine: grid
labs:
  - dynamic-programming
sources:
  - id: sedgewick-aic-1990
    ref: Advanced Topics
tags:
  - dynamic programming
  - strings
  - alignment
complexity: "Θ(mn) time and space for strings of lengths m and n"
related:
  - knapsack-dp
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
  - Fill a table over the prefixes of two strings from three neighbours per cell.
  - Read one longest common subsequence back by a traceback from the corner.
algorithm:
  paradigm: dynamic-programming
bounds:
  model: table cells computed
  worst: Θ(mn) for strings of lengths m and n
  space: Θ(mn)
---

The longest sequence both strings contain in order, read back from a filled table.

The rows spell the first string and the columns the second. A cell holds the length of the longest common subsequence of the two prefixes: one more than its diagonal neighbour when the letters match, otherwise the larger of the cells above and to the left.

The traceback starts in the bottom-right corner and walks back to the edge: a diagonal step takes the matching letter, any other step moves towards the larger neighbour. The letters collected in reverse are one longest common subsequence; there may be others of the same length.

The same table, with costs instead of lengths, is edit distance and global sequence alignment; the dependency on three neighbours is what lets it fill row by row.
