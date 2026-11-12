---
id: samplesort
title: Samplesort
taxonomy: sorting/parallel
status: planned
engine: array
labs:
  - sorting
sources:
  - id: frazer-1970
    ref: the original sampling idea
  - id: sanders-2019
    ref: splitters, oversampling and expected cost
  - id: sanders-2004
    ref: super scalar samplesort without branches
  - id: axtmann-2022
    ref: IPS⁴o and its experimental comparison
tags:
  - sorting
  - parallel
  - splitters
  - multiway partitioning
complexity: n log n best, n log n average, n² worst; extra space n
related:
  - multi-pivot-quicksort
  - proportion-extend-sort
  - quicksort
---

Quicksort with many pivots: draw a random sample, sort it, take k − 1 evenly spaced sample keys as splitters, distribute every key into one of k buckets by binary search among the splitters, and sort each bucket recursively.

Oversampling, several sample keys per bucket, keeps the buckets close to equal in size with high probability, which gives an expected n log n comparisons; the guarantee is only in expectation, and a run of unlucky samples behaves like quicksort with bad pivots, quadratic in the worst case. The gain over quicksort is that each level moves the data once while splitting it k ways, so there are only about log n / log k levels: fewer passes over external memory and less communication between processors.

The plate oversamples by three keys per bucket, shows the buckets filling in the auxiliary strip, and finishes small buckets by insertion sort; keys equal to a splitter get a bucket of their own, which needs no further work. Start with Random permutation at n = 64 (the kernel's default is four buckets), then try Few distinct keys: the equal-key buckets absorb whole runs at once. The simulation happens to keep equal keys in order, but samplesort is not specified as stable.

Frazer and McKellar introduced the sample in 1970; Sanders and Winkel revived it in 2004 for modern processors by classifying keys through an implicit search tree without conditional branches, which removes the branch mispredictions that slow quicksort down. That line leads to IPS⁴o, which its authors' extensive comparison ranks among the fastest general-purpose sorts. For small inputs the cost of drawing and sorting the sample outweighs the savings.
