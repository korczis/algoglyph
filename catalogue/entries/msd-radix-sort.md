---
id: msd-radix-sort
title: MSD radix sort
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
  - radix
  - non-comparison
  - digits
  - recursive
complexity: about n log_R n digit examinations
related:
  - lsd-radix-sort
  - three-way-radix-quicksort
---

Distribute by the leading base-4 digit, then sort each bin on the next digit, recursively.

The bands are the bins: four at the top level, each splitting into four. Small bins are where MSD wastes effort, which is why practical versions cut over to insertion sort.
