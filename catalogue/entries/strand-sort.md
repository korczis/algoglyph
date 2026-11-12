---
id: strand-sort
title: Strand sort
taxonomy: sorting/mergesort
status: live
engine: array
labs:
  - sorting
sources:
  - id: black-2020
    ref: the dictionary definition
  - id: knuth-taocp-3
    ref: "5.2.4 Sorting by merging"
tags:
  - sorting
  - merging
  - quadratic
  - stable
  - adaptive
  - runs
complexity: n best, n² average and worst; extra space n
related:
  - mergesort-natural
  - mergesort-top-down
  - patience-sorting
  - selection-sort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites: [mergesort-natural]
  objectives:
  - 'Count Already sorted: one strand, n − 1 comparisons, n array writes and 3n auxiliary writes.'
  - 'Count Reversed at 328 keys: n strands of one key and (n − 1)(n + 2)/2 = 53,955 comparisons.'
  - 'Read the Array writes: always n, the final copy of the result, whatever the input.'
  misconceptions:
  - 'Strand sort is a mergesort and so n log n; each strand is merged with the whole result, and Reversed costs (n − 1)(n + 2)/2 comparisons.'
algorithm:
  paradigm: incremental
  properties:
    stable: true
    in_place: false
    comparison_based: true
bounds:
  model: 'comparisons, array writes (the result copied back) and auxiliary writes (the remaining input, the strand and the result, each cell that changes)'
  best: 'n − 1 comparisons, n array writes and 3n auxiliary writes (Already sorted, keys all equal: one strand)'
  average: 'n array writes on every input of two or more keys'
  worst: '(n − 1)(n + 2)/2 comparisons and n(n + 2) auxiliary writes on Reversed, n strands of one key; the most comparisons of any permutation up to 8 keys'
claims:
  - id: reversed-is-quadratic
    statement: >-
      On Reversed at 328 keys strand sort pulls n strands of one key and makes (n − 1)(n + 2)/2 = 53,955 comparisons.
    readout: Comparisons
    expect: { value: 53955 }
    setup:
      params: { shape: reversed, n: 328 }
---

Pull an increasing strand out of the input, merge it into the result, and repeat until the input is empty: the strand starts with the first remaining key and takes every later key larger than its last one.

Unlike natural mergesort, which takes only contiguous runs, a strand gathers keys scattered across the whole remainder in one greedy left-to-right pass. Already sorted becomes a single strand and costs a linear pass; Reversed gives strands of one key each, n passes over a shrinking remainder, and a quadratic total. Start with Nearly sorted at n = 64, where long strands mean little merging, then switch to Random permutation to see the strands shrink and the cost climb.

The dictionary definition gives no complexity, so the bounds above are derived from the procedure itself, not taken from a peer-reviewed analysis, and no paper introducing or analysing the method has been found. Stability follows from the strict "larger than" test, which never lets a later equal key into an earlier strand, together with a merge that prefers the result on ties.

The imbalance is what makes it slow: each short strand is merged with the whole growing result, where a balanced mergesort merges parts of similar size. It suits teaching, and nearly sorted linked lists, where taking a node out and appending it to a strand is cheap.
