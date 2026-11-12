---
id: stooge-sort
title: Stooge sort
taxonomy: sorting/esoteric
status: planned
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
---

Exchange the first and last keys if they are out of order; then, for three or more keys, recursively sort the first two thirds, the last two thirds, and the first two thirds again.

It is always correct: after the first call the largest keys of the front part sit in its upper third, inside the range of the second call, which therefore carries the largest third of the whole range to the end. The cost follows T(n) = 3T(2n/3) + Θ(1), and the master method gives Θ(n^(log 3 / log 1.5)), about n^2.71: worse than every quadratic sort, and the same on every input, because the comparisons never depend on the keys.

Cormen and colleagues pose it as a textbook problem, credited with a wink to fictional professors named after the Three Stooges; it exercises a correctness proof by induction with careful rounding of the thirds and a recurrence with an unusual exponent. Its original author is unknown. Three calls on two thirds push the exponent above 2, where mergesort's two calls on halves give n log n: the contrast is the lesson.

This is a bespoke plate: at the array engine's largest size the run takes tens of millions of comparisons, too many to record and replay as a trace. The plate caps n (it stays watchable up to about a hundred keys), lets the reader choose the input shape, and plots the measured comparisons against n^2.71; Already sorted is a good default, since stooge sort does all of its work without changing anything after the first exchange.
