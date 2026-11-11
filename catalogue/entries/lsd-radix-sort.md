---
id: lsd-radix-sort
title: LSD radix sort
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
  - stable
  - non-comparison
  - digits
complexity: W passes of key-indexed counting for W digits
---

Sort by the least significant base-4 digit first, with one stable counting pass per digit.

After the pass on digit d, the keys are sorted on their last d digits; stability is what keeps the earlier passes intact.
