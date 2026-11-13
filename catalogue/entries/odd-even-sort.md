---
id: odd-even-sort
title: Odd-even transposition sort
taxonomy: sorting/elementary
status: live
engine: array
labs:
  - sorting
sources:
  - id: habermann-1972
    ref: the proof that n rounds always suffice
  - id: knuth-taocp-3
    ref: "5.3.4 Networks for sorting"
tags:
  - sorting
  - quadratic
  - stable
  - in-place
  - adaptive
  - parallel
  - brick sort
complexity: n best, n² average and worst; extra space 1
related:
  - bubble-sort
  - shaker-sort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  prerequisites:
  - bubble-sort
  objectives:
  - 'Count the Rounds readout: every exchange falls within the first n rounds, and the run stops after at most 2⌈n/2⌉ + 2.'
  - 'Read the Array writes as twice the inversions, as in bubble sort.'
  - 'See Already sorted end after two rounds and n − 1 comparisons.'
  misconceptions:
  - 'Parallel rounds make the total work smaller; on one processor it stays quadratic, and only the rounds are few.'
algorithm:
  paradigm: iterative-refinement
  properties:
    stable: true
    in_place: true
    comparison_based: true
bounds:
  model: 'comparisons, array writes (an exchange is two writes) and rounds'
  best: '2 rounds, n − 1 comparisons and no writes (Already sorted)'
  average: 'on every input, array writes = 2 × inversions'
  worst: 'the last exchange within the first n rounds, and at most 2⌈n/2⌉ + 2 rounds before the run stops'
claims:
  - id: sorted-two-rounds
    statement: >-
      On Already sorted at 128 keys odd-even transposition sort stops after 2 rounds, an odd and an even phase that exchange nothing, with n − 1 = 127 comparisons.
    readout: Rounds
    expect: { value: 2 }
    setup:
      params: { shape: sorted, n: 128 }
---

Alternate two kinds of round over neighbouring pairs: counting positions from 0, the odd round compares (1, 2), (3, 4), …, the even round (0, 1), (2, 3), …, and every pair out of order is exchanged; the run begins with an odd round.

The pairs of one round never overlap, so on a row of processors each round takes constant time and n rounds always sort n keys; Habermann proved this bound by induction. As a network it uses only comparators between neighbours, which is why it maps onto a linear array of simple cells. On one processor it compares the same neighbouring pairs as bubble sort in a different order, and exchanges exactly as many times as the input has inversions.

The sequential version here stops after an odd and an even round in a row make no exchange, so Already sorted costs two rounds. Try Random permutation at n = 64 and count the rounds: the work stays quadratic, which is the price of the regularity that makes it parallel.

It is stable, because only neighbours are exchanged and only when strictly out of order. For sorting large inputs in parallel, networks that also compare distant keys, such as bitonic sort and Batcher's merge, reach depth of order log² n instead of n.
