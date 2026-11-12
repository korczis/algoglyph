---
id: samplesort
title: Samplesort
taxonomy: sorting/parallel
status: live
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
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites: [quicksort]
  objectives:
  - 'Run 32 keys or fewer: no phase at all, insertion sort finishes the input alone; above, each distribution shows two phases, the sample of 12 keys and the classification into 7 buckets.'
  - 'Compare Random permutation and Few distinct keys at 512 keys: 6,390 comparisons against 1,968.'
  - 'Explain why a key equal to a splitter needs no further sorting.'
  misconceptions:
  - 'Samplesort is a parallel algorithm, so its plate shows processors; this kernel is sequential, with no round and no lane, only phases.'
algorithm:
  paradigm: divide-and-conquer
  properties:
    in_place: false
    comparison_based: true
bounds:
  model: 'comparisons (sample sorts, classification among three splitters with an equality test, insertion sorts), array writes (each distribution writes its part back; exchanges of the insertion sorts, two each) and auxiliary writes (splitters and buckets)'
  best: 'up to 32 keys insertion sort alone: on Already sorted n − 1 comparisons and no write'
  average: 'no round and no lane; an even number of phases, two per distribution; on keys 1 to 4 at most three distributions; expected n log n and n² worst are the published bounds of samplesort'
claims:
  - id: equal-key-buckets
    statement: >-
      On Few distinct keys at 512 keys samplesort makes 1,968 comparisons, under a third of the 6,390 on Random permutation: keys equal to a splitter fall into buckets of their own that are never sorted again.
    readout: Comparisons
    expect: { value: 1968 }
    setup:
      params: { shape: few-unique, n: 512 }
---

Quicksort with many pivots: draw a random sample, sort it, take k − 1 evenly spaced sample keys as splitters, distribute every key into one of k buckets by binary search among the splitters, and sort each bucket recursively.

Oversampling, several sample keys per bucket, keeps the buckets close to equal in size with high probability, which gives an expected n log n comparisons; the guarantee is only in expectation, and a run of unlucky samples behaves like quicksort with bad pivots, quadratic in the worst case. The gain over quicksort is that each level moves the data once while splitting it k ways, so there are only about log n / log k levels: fewer passes over external memory and less communication between processors.

The plate oversamples by three keys per bucket, shows the buckets filling in the auxiliary strip, and finishes small buckets by insertion sort; keys equal to a splitter get a bucket of their own, which needs no further work. Start with Random permutation at n = 64 (the kernel's default is four buckets), then try Few distinct keys: the equal-key buckets absorb whole runs at once. The simulation happens to keep equal keys in order, but samplesort is not specified as stable.

Frazer and McKellar introduced the sample in 1970; Sanders and Winkel revived it in 2004 for modern processors by classifying keys through an implicit search tree without conditional branches, which removes the branch mispredictions that slow quicksort down. That line leads to IPS⁴o, which its authors' extensive comparison ranks among the fastest general-purpose sorts. For small inputs the cost of drawing and sorting the sample outweighs the savings.
