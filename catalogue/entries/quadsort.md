---
id: quadsort
title: Quadsort
taxonomy: sorting/mergesort
status: live
engine: array
labs:
  - sorting
sources:
  - id: vandenhoven-2020
    ref: the author's repository and description
  - id: peters-2023
    ref: glidesort, which generalises its parity merge
tags:
  - sorting
  - merging
  - stable
  - adaptive
  - branchless
complexity: n best, n log n average and worst; extra space n
related:
  - mergesort-bottom-up
  - timsort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites: [mergesort-bottom-up, insertion-sort]
  objectives:
  - 'Count Already sorted at a multiple of 32 keys: 5n/4 − 1 comparisons and no write, 639 at 512.'
  - 'Count Reversed at 512 keys: 638 comparisons and 512 writes, the array reversed as one run.'
  - 'Below 32 keys count insertion sort alone: the Array writes are twice the inversions.'
  misconceptions:
  - 'A mergesort must merge even sorted input; quadsort recognises Already sorted and Reversed and settles them in about 5n/4 comparisons.'
algorithm:
  paradigm: divide-and-conquer
  properties:
    stable: true
    in_place: false
    comparison_based: true
bounds:
  model: 'comparisons, array writes (an exchange is two writes, a copy one) and auxiliary writes (the shorter run, copied for each merge)'
  best: 'when n is a multiple of 32: 5n/4 − 1 comparisons and no writes on Already sorted; 5n/4 − 2 comparisons, n array writes and no auxiliary write on Reversed'
  average: 'below 32 keys insertion sort alone, with array writes = 2 × inversions and inversions ≤ comparisons ≤ inversions + n − 1; n log n (the author''s claim)'
  worst: 'n log n (the author''s claim)'
claims:
  - id: reversed-is-one-run
    statement: >-
      On Reversed at 512 keys quadsort reverses the array as one run: 5n/4 − 2 = 638 comparisons.
    readout: Comparisons
    expect: { value: 638 }
    setup:
      params: { shape: reversed, n: 512, speed: 2000 }
---

A stable, adaptive bottom-up mergesort written to avoid conditional branches in its inner loops: it uses the outcome of a comparison as a number for computing an index instead of as a jump, because on random data a mispredicted branch is the costliest thing a modern processor does.

It works in three layers. A quad-swap analyser walks the array eight keys at a time, turns the comparisons of the pairs into a bit mask, sorts each block and notices sorted and reverse-sorted stretches (a wholly reversed array is just reversed and done). A ping-pong merge then combines four blocks at a time, merging into the auxiliary memory and back so that no copy-back pass is needed, and skips four blocks already in order. A parity merge merges two equal-length runs from both ends at once, which removes the bounds checks.

Start with Random permutation at n = 256 and watch the auxiliary strip fill and empty as the merges ping-pong; then Already sorted and Reversed, which the analyser settles with about 5n/4 comparisons. The default buffer is n keys; with no memory available it still sorts, in place by rotations, only slower.

There is no peer-reviewed analysis: the bounds (n best, n log n average and worst) and the author's report that the branchless parity merge is up to 2.5 times faster on random data are claims from the official repository, not proved results. Where a published guarantee matters, Timsort or powersort is the safer choice.
