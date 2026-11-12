---
id: spreadsort
title: Spreadsort
taxonomy: sorting/radix
status: live
engine: array
labs:
  - sorting
sources:
  - id: ross-2002
    ref: the original description
  - id: ross-2017
    ref: Boost.Sort integer_sort documentation
tags:
  - sorting
  - radix
  - in-place
  - hybrid
complexity: linear on well-spread keys; worst case the better of n log n and n log(b/s + s) for b-bit keys; extra space proportional to the key length
motivation: Boost.Sort ships it as integer_sort, float_sort and string_sort, drop-in alternatives to std::sort.
related:
  - american-flag-sort
  - msd-radix-sort
  - pdqsort
---

Find the minimum and maximum, split the range between them into bins by the top bits in which the keys still differ, move the keys into their bins in place, and either spread each bin again or finish it with a comparison sort.

The decision at every level is what makes it a hybrid: Spreadsort spreads by bits while that guarantees the better worst case, and hands a bin to comparison sorting when that does. The Boost documentation states the worst case as the better of n log n comparisons and n log(b/s + s) operations for b-bit keys, which is why it copes with clustered data that many radix sorts handle badly.

Boost hands inputs below about a thousand elements straight to std::sort; the kernel lowers that threshold to small bins so the spreading is visible on the plate's sizes. Start with Random permutation at n = 256 to see one spreading pass followed by short comparison sorts inside the bins, then Already sorted, which is detected while the minimum and maximum are found.

Ross's 2002 paper reports linear time for continuous integrable key distributions. The Boost tables list it as unstable and using memory proportional to the key length rather than to n; for a stable sort of integer keys, LSD radix sort is the comparison.
