---
id: quadsort
title: Quadsort
taxonomy: sorting/mergesort
status: planned
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
---

A stable, adaptive bottom-up mergesort written to avoid conditional branches in its inner loops: it uses the outcome of a comparison as a number for computing an index instead of as a jump, because on random data a mispredicted branch is the costliest thing a modern processor does.

It works in three layers. A quad-swap analyser walks the array eight keys at a time, turns the comparisons of the pairs into a bit mask, sorts each block and notices sorted and reverse-sorted stretches (a wholly reversed array is just reversed and done). A ping-pong merge then combines four blocks at a time, merging into the auxiliary memory and back so that no copy-back pass is needed, and skips four blocks already in order. A parity merge merges two equal-length runs from both ends at once, which removes the bounds checks.

Start with Random permutation at n = 256 and watch the auxiliary strip fill and empty as the merges ping-pong; then Already sorted and Reversed, which the analyser settles with about n comparisons. The default buffer is n keys; with no memory available it still sorts, in place by rotations, only slower.

There is no peer-reviewed analysis: the bounds (n best, n log n average and worst) and the author's report that the branchless parity merge is up to 2.5 times faster on random data are claims from the official repository, not proved results. Where a published guarantee matters, Timsort or powersort is the safer choice.
