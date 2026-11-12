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
  - longest-common-subsequence
  - myers-diff
complexity: "O(|a| · |b|) time and cells"
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
  - Fill cell (i, j) with the least of delete, insert and keep or substitute from its three neighbours.
  - Read the distance from the bottom-right cell.
  - Walk back through the cells that produced each minimum to list one cheapest edit script.
algorithm:
  paradigm: dynamic-programming
bounds:
  model: cells written and character comparisons
  best: '(|a| + 1)(|b| + 1) cells and |a| · |b| comparisons'
  worst: '(|a| + 1)(|b| + 1) cells and |a| · |b| comparisons'
  space: '(|a| + 1)(|b| + 1) cells'
---

The edit table filled cell by cell, and the cheapest path of insertions, deletions and substitutions through it.

Cell (i, j) holds the distance between the first i characters of one name and the first j of the other: the least of the cell above plus one (delete), the cell to the left plus one (insert) and the diagonal cell plus zero or one (keep or substitute). The table fills row by row, coloured by value; the bottom-right cell is the distance.

Walking back from that corner through cells that produced each minimum marks one cheapest path, listed as the edit script: plain letters are kept, x→y substitutes, −x deletes and +y inserts. Its number of edits equals the distance.
