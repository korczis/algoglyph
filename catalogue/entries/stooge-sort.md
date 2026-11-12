---
id: stooge-sort
title: Stooge sort
taxonomy: sorting/esoteric
status: live
engine: custom
sources:
  - id: cormen-2009
    ref: an end-of-chapter problem on stooge sort
  - id: cormen-2022
    ref: "Chapter 4: the master method"
  - id: broder-1984
    ref: the slower slowsort
tags:
  - sorting
  - esoteric
  - in-place
  - recursion
  - deterministic
complexity: n^2.71 in every case; extra space log n
related:
  - bubble-sort
  - mergesort-top-down
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites: [mergesort-top-down]
  objectives:
  - 'Read comparisons, counted live at the end of a run at 24 keys: 3,280 of 3,280, C(n) = 1 + 3·C(n − ⌊n/3⌋), whatever the input shape.'
  - 'Choose Already sorted: all of the comparisons and no swap.'
  - 'Compare the growth exponent fitted to the kernel with the master theorem''s log 3 / log 1.5 = 2.7095 beside it; for even n, 1.5n keys cost exactly 3·C(n) + 1.'
  misconceptions:
  - 'Recursion on overlapping thirds is as good as mergesort''s halves; three calls on two thirds give n^2.7095, worse than every quadratic sort.'
algorithm:
  paradigm: divide-and-conquer
  properties:
    stable: false
bounds:
  model: 'comparisons (one per call) and swaps, counted live'
  best: 'no swap on Already sorted'
  average: 'exactly C(n) = 1 + 3·C(n − ⌊n/3⌋) comparisons on every input of n ≥ 3 keys, 1 for n = 2 (test/plate-stooge-sort.test.ts, against the kernel); at most as many swaps as the input has inversions'
  worst: 'Θ(n^(log 3 / log 1.5)) by the master method (Cormen et al.); C(1.5n) = 3·C(n) + 1 for even n'
---

Exchange the first and last keys if they are out of order; then, for three or more keys, recursively sort the first two thirds, the last two thirds, and the first two thirds again.

It is always correct: after the first call the largest keys of the front part sit in its upper third, inside the range of the second call, which therefore carries the largest third of the whole range to the end. The cost follows T(n) = 3T(2n/3) + Θ(1), and the master method gives Θ(n^(log 3 / log 1.5)), about n^2.71: worse than every quadratic sort, and the same on every input, because the comparisons never depend on the keys.

Cormen and colleagues pose it as a textbook problem, credited with a wink to fictional professors named after the Three Stooges; it exercises a correctness proof by induction with careful rounding of the thirds and a recurrence with an unusual exponent. Its original author is unknown. Three calls on two thirds push the exponent above 2, where mergesort's two calls on halves give n log n: the contrast is the lesson.

This is a bespoke plate: at the array engine's largest size the run takes tens of millions of comparisons, too many to record and replay as a trace. The plate caps n at 128 keys, lets the reader choose the input shape, and runs the kernel's recursion step by step on an explicit stack, drawing the calls that wait on it. The chart plots, on log-log axes, the comparisons the compiled kernel counts for every n up to the chosen one, the exact recurrence C(n) = 1 + 3·C(n − ⌊n/3⌋), this run's count as it rises, and n^(log 3 / log 1.5) through the chosen n; the readouts give the exponent fitted to the kernel's counts. The rounding of the thirds makes the curve a staircase around the power. Try Already sorted too: stooge sort does all of its work without changing anything.
