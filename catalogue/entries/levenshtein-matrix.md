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
claims:
  - id: cost-two-is-lcs-distance
    statement: >-
      At substitution cost 2 a substitution is never cheaper than a deletion and an insertion, so
      the distance is |a| + |b| − 2·LCS. At seed 4 the pair is "Lukáš Zuzana Král" against
      "Lukas Zuzana Kral": 17 characters each, three marks dropped, LCS 14, so 34 − 28 = 6.
    readout: Distance
    expect: { value: 6 }
    setup:
      params: { sub: '2' }
      seed: 4
  - id: cost-one-same-pair
    statement: >-
      The same pair at cost 1: the strings differ in three positions of equal length, so three
      substitutions reach it (D ≤ 3), and every edit raises the common subsequence by at most
      one, so D ≥ 17 − LCS = 3. The distance is 3 exactly.
    readout: Distance
    expect: { value: 3 }
    setup:
      seed: 4
  - id: cells-independent-of-cost
    statement: >-
      Every cell is written once whatever a substitution costs: the seeded pair (16 and 15
      characters) fills (16 + 1)(15 + 1) = 272 cells at cost 2.
    readout: Cells written
    expect: { value: 272 }
    setup:
      params: { sub: '2' }
  - id: cost-one-within-length-bounds
    statement: >-
      At cost 1 the distance is at least the difference of the lengths and at most the longer
      length (substitute the overlap, insert the rest): between 16 − 15 = 1 and 16 for the seeded
      pair.
    readout: Distance
    expect: { range: [1, 16] }
---

The edit table filled cell by cell, and the cheapest path of insertions, deletions and substitutions through it.

Cell (i, j) holds the distance between the first i characters of one name and the first j of the other: the least of the cell above plus one (delete), the cell to the left plus one (insert) and the diagonal cell plus zero or the substitution cost (keep or substitute), 1 unless the control sets 2. The table fills row by row, coloured by value; the bottom-right cell is the distance.

Walking back from that corner through cells that produced each minimum marks one cheapest path, listed as the edit script: plain letters are kept, x→y substitutes, −x deletes and +y inserts. At substitution cost 1 its number of edits equals the distance; at cost 2 a substitution counts twice, as a deletion and an insertion would, and the distance becomes |a| + |b| − 2·LCS.
