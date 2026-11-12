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
---

Pull an increasing strand out of the input, merge it into the result, and repeat until the input is empty: the strand starts with the first remaining key and takes every later key larger than its last one.

Unlike natural mergesort, which takes only contiguous runs, a strand gathers keys scattered across the whole remainder in one greedy left-to-right pass. Already sorted becomes a single strand and costs a linear pass; Reversed gives strands of one key each, n passes over a shrinking remainder, and a quadratic total. Start with Nearly sorted at n = 64, where long strands mean little merging, then switch to Random permutation to see the strands shrink and the cost climb.

The dictionary definition gives no complexity, so the bounds above are derived from the procedure itself, not taken from a peer-reviewed analysis, and no paper introducing or analysing the method has been found. Stability follows from the strict "larger than" test, which never lets a later equal key into an earlier strand, together with a merge that prefers the result on ties.

The imbalance is what makes it slow: each short strand is merged with the whole growing result, where a balanced mergesort merges parts of similar size. It suits teaching, and nearly sorted linked lists, where taking a node out and appending it to a strand is cheap.
