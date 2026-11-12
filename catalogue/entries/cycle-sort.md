---
id: cycle-sort
title: Cycle sort
taxonomy: sorting/elementary
status: live
engine: array
labs:
  - sorting
sources:
  - id: haddon-1990
    ref: the original description
  - id: knuth-taocp-3
    ref: "5.2 Internal sorting"
  - id: sedgewick-2011
    ref: "Chapter 2: Sorting"
tags:
  - sorting
  - quadratic
  - in-place
  - minimal writes
  - permutation cycles
complexity: n² in every case; extra space 1
related:
  - counting-sort
  - selection-sort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites:
  - selection-sort
  objectives:
  - 'Read the Array writes as the number of keys out of place: each is written once, straight to its final position, and never more than n.'
  - 'Count at least n(n − 1)/2 comparisons on every input, and exactly that with no write on Already sorted.'
  - 'See Reversed break into cycles of two, each key trading places with its mirror, while Random permutation forms long cycles.'
  misconceptions:
  - 'Few writes mean little work; the comparisons stay quadratic on every input, Already sorted included.'
algorithm:
  paradigm: incremental
  properties:
    stable: false
    in_place: true
    comparison_based: true
bounds:
  model: 'comparisons and array writes (a write puts one key in its final place)'
  best: 'n(n − 1)/2 comparisons and no writes (Already sorted)'
  average: 'on every input, array writes = keys not at their sorted position, and comparisons ≥ n(n − 1)/2'
  worst: 'at most n array writes'
---

Follow the cycles of the permutation: take a key, count how many keys are smaller to find its final position, write it there, pick up the key it displaces, and continue until the cycle returns to its start.

Every key that is out of place is written exactly once, straight to its final position, and a key already in place is never written at all. That is the minimum possible: each misplaced key must be written at least once. Equal keys need care: before writing, the kernel skips past copies of the held key that already sit at the target, otherwise the cycle would never close.

Finding a final position costs a linear scan, and every start position is scanned, so the comparison version is quadratic on every input, Already sorted included. Start with Random permutation at n = 64 and watch the writes counter stay below n while the comparisons climb; Reversed at the same size breaks into cycles of two, each key trading places with its mirror, and Already sorted shows a full scan with no writes.

Selection sort also keeps exchanges low, at most n − 1, but it can move a key more than once; cycle sort writes each key at most once. The method makes sense where a write is far dearer than a read, for instance on memory that wears out with rewriting or when each record is large. With cheap writes any n log n method is faster. It sorts in place and is not stable.
