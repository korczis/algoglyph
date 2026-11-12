---
id: levenshtein-matrix
title: Levenshtein distance
taxonomy: strings/similarity
status: live
engine: string
labs:
  - name-similarity
sources:
  - id: practice-entity-resolution
tags:
  - edit distance
  - dynamic programming
  - fuzzy matching
motivation: Resolving one company or person across noisy public registries needs it.
related:
  - jaro-winkler
  - longest-common-subsequence
  - myers-diff
complexity: "O(|a| · |b|) time and cells"
---

The edit table filled cell by cell, and the cheapest path of insertions, deletions and substitutions through it.

Cell (i, j) holds the distance between the first i characters of one name and the first j of the other: the least of the cell above plus one (delete), the cell to the left plus one (insert) and the diagonal cell plus zero or one (keep or substitute). The table fills row by row, coloured by value; the bottom-right cell is the distance.

Walking back from that corner through cells that produced each minimum marks one cheapest path, listed as the edit script: plain letters are kept, x→y substitutes, −x deletes and +y inserts. Its number of edits equals the distance.
