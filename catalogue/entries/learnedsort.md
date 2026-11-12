---
id: learnedsort
title: LearnedSort
taxonomy: sorting/distribution
status: live
engine: array
labs:
  - sorting
sources:
  - id: kristo-2020
    ref: the original description and experiments
  - id: kristo-2021
    ref: LearnedSort 2.0 and the duplicate-key problem
tags:
  - sorting
  - distribution
  - buckets
  - learned model
  - cdf
complexity: linear on keys the model fits well; no worst case is given (insertion repair makes it n² if the model is badly wrong); extra space n
related:
  - bucket-sort
  - flashsort
  - insertion-sort
  - interpolation-sort
  - skasort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites: [bucket-sort]
  objectives:
  - 'Follow the Phase readout at 512 keys: a sample of 22 keys sorted, the model trained, n writes into the buckets, and a touch-up insertion sort of I + n − 1 − z comparisons for the I inversions the buckets leave.'
  - 'Run Already sorted at 512 keys: the model places every key, so the Array writes stay at n = 512, against 1,945 on Random permutation.'
  - 'Run Random permutation at 256 keys: the model misplaces the keys, and the touch-up insertion sort makes 6,428 of the run''s 6,502 comparisons.'
  misconceptions:
  - 'A learned model always leaves the repair pass little to do; on Random permutation at 256 keys the buckets leave 6,174 inversions, and the touch-up makes 6,428 comparisons.'
algorithm:
  properties:
    stable: false
    in_place: false
bounds:
  model: 'comparisons (the sample''s insertion sort and the touch-up insertion sort), array writes (n for the bucketed keys written back, then the touch-up''s shifts) and auxiliary writes (the sample of s keys and the n bucketed keys, drawn once each)'
  average: 'from 16 keys on: a sample of s = max(16, ⌊√n⌋) keys sorted with s − 1 to s(s − 1)/2 comparisons, n writes for the buckets, a touch-up of I + n − 1 − z comparisons and I + v writes (I inversions left, z keys smaller than every key before them, v keys with a larger key before them), and s + n auxiliary writes; below 16 keys an exchange insertion sort'
claims:
  - id: sorted-needs-no-repair
    statement: >-
      On Already sorted at 512 keys the model places every key: the Array writes are exactly n = 512, the bucketed keys written back, and the touch-up insertion sort moves nothing.
    readout: Array writes
    expect: { value: 512 }
    setup:
      params: { shape: sorted, n: 512, speed: 2000 }
---

Learn the keys' cumulative distribution from a sample, use the model's prediction to place every key in a bucket near its final position, and repair the remaining mistakes with insertion sort.

It is a bucket sort whose bucket function is a trained model instead of a fixed formula. The kernel sorts a seeded random sample, fits a small two-layer model of rank against key, sends every key to bucket ⌊CDF(x)·B⌋, and runs a final insertion pass. The original adds a model-driven counting sort inside each fragment and a spill bucket for overflow, which the kernel replaces with ordered buckets.

The authors' analysis is mostly experimental: sampling, prediction and distribution are linear, and the final insertion sort is close to linear because a good model leaves only small errors. They give no worst case; if the model ranked keys badly, the insertion sort would be left with quadratic work, an inference rather than a published bound. Random permutation at n = 512 is a distribution the model fits well, 1,718 comparisons in all; at n = 256 the plate's first input is one its sampled model gets badly wrong, and the touch-up insertion sort makes 6,428 of the run's 6,502 comparisons, the repair cost inferred above. Organ pipe asks it to model a less convenient order.

Duplicates were the original's weakness: equal keys get equal predictions, overfill their bucket and push the work into the overflow path. LearnedSort 2.0 replaced the spill bucket with fixed-capacity fragments and reports large speed-ups on duplicate-heavy data; the 2020 paper measured it ahead of std::sort, radix sort and a C++ Timsort on normally distributed doubles.
