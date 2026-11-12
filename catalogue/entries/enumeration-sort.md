---
id: enumeration-sort
title: Enumeration sort
taxonomy: sorting/parallel
status: live
engine: array
labs:
  - sorting
sources:
  - id: knuth-taocp-3
    ref: "5.2 Internal sorting (comparison counting)"
  - id: muller-1975
    ref: the logarithmic-time network built on it
  - id: sanders-2019
    ref: the fast, inefficient parallel sort
tags:
  - sorting
  - parallel
  - quadratic
  - stable
  - ranking
complexity: n² in every case; extra space n
related:
  - counting-sort
  - selection-sort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  prerequisites: [counting-sort]
  objectives:
  - 'Run any shape at 472 keys, the plate''s largest: n(n − 1) = 222,312 comparisons and 472 array writes, the same on every input.'
  - 'Read the Rounds and Lanes readouts: 2 rounds, rank and write, and one lane per key, 472 of them.'
  - 'Explain why counting the equal keys that come earlier as smaller makes the ranks distinct and the sort stable.'
  misconceptions:
  - 'Presorted input saves enumeration sort some work; every lane compares its key with every other on every input, n(n − 1) comparisons, 222,312 at 472 keys on Already sorted as on Random.'
algorithm:
  properties:
    stable: true
    in_place: false
    comparison_based: true
bounds:
  model: 'comparisons (every lane against every other key), array writes (each key to its rank), auxiliary writes (the ranks), rounds (rank, write) and lanes (one per key)'
  average: 'on every input of n ≥ 2 keys exactly n(n − 1) comparisons, n array writes, n auxiliary writes, 2 rounds and n lanes; the O(log n) time with n² processors is Muller and Preparata''s'
claims:
  - id: same-work-on-sorted-input
    statement: >-
      On Already sorted at 472 keys enumeration sort makes 222,312 comparisons, n(n − 1), exactly as on every other input: each of the 472 lanes compares its key with all the others.
    readout: Comparisons
    expect: { value: 222312 }
    setup:
      params: { shape: sorted, n: 472 }
---

Comparison counting: the final position of a key is the number of keys smaller than it, so compare every key with every other, sum the results per key, and move each key once to its rank.

Sequentially it always performs n(n − 1)/2 comparisons, wasteful by any measure, and nothing moves until the very end. In parallel every comparison is independent: with n² processors in a matrix all comparisons happen at once and the ranks are summed in logarithmic time. Muller and Preparata built on exactly this a network that sorts in time on the order of log n, the first one known to beat log² n without adaptive control.

The plate runs one lane per key, each comparing its key against all the others, one lane after another, and counts the total work; the parallel time is prose, not a readout. Counting equal keys that come earlier as smaller makes it stable. Because every lane compares its key with all the others, the plate's compare count is n(n − 1), twice the sequential minimum, and it is the same on every shape. Start with Random permutation at n = 32 and watch the writes come in a single burst at the end.

Its places are where speed matters more than efficiency, such as ranking a small sample of pivot candidates inside a parallel samplesort, and where moving a record is expensive and comparing is cheap, because every key moves at most once. Counting sort is its cousin for small integer keys: it counts values instead of comparisons.
