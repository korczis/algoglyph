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
---

Learn the keys' cumulative distribution from a sample, use the model's prediction to place every key in a bucket near its final position, and repair the remaining mistakes with insertion sort.

It is a bucket sort whose bucket function is a trained model instead of a fixed formula. The kernel sorts a seeded random sample, fits a small two-layer model of rank against key, sends every key to bucket ⌊CDF(x)·B⌋, and runs a final insertion pass. The original adds a model-driven counting sort inside each fragment and a spill bucket for overflow, which the kernel replaces with ordered buckets.

The authors' analysis is mostly experimental: sampling, prediction and distribution are linear, and the final insertion sort is close to linear because a good model leaves only small errors. They give no worst case; if the model ranked keys badly, the insertion sort would be left with quadratic work, an inference rather than a published bound. Random permutation at n = 256 is a distribution a linear model fits well; Organ pipe asks it to model a less convenient order.

Duplicates were the original's weakness: equal keys get equal predictions, overfill their bucket and push the work into the overflow path. LearnedSort 2.0 replaced the spill bucket with fixed-capacity fragments and reports large speed-ups on duplicate-heavy data; the 2020 paper measured it ahead of std::sort, radix sort and a C++ Timsort on normally distributed doubles.
