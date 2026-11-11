---
id: binary-quicksort
title: Binary quicksort
taxonomy: sorting/radix
status: live
engine: array
labs:
  - sorting
sources:
  - id: sedgewick-aic
    ref: "Part 3: Sorting"
tags:
  - sorting
  - radix exchange
  - bits
  - non-comparison
  - in-place
complexity: about n lg n bit examinations
related:
  - quicksort
  - msd-radix-sort
---

Radix exchange: partition on the leading bit, then recurse on the next bit.

It partitions like quicksort but on a bit instead of a pivot key, so the comparison counter stays at zero and the bands split exactly at powers of two.
