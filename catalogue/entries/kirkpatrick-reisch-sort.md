---
id: kirkpatrick-reisch-sort
title: Kirkpatrick–Reisch sort
taxonomy: sorting/radix
status: planned
engine: array
labs:
  - sorting
sources:
  - id: kirkpatrick-1984
    ref: the range-reduction result
  - id: kirkpatrick-1981
    ref: the earlier technical report
  - id: cormen-2022
    ref: "Chapter 8: Sorting in linear time"
tags:
  - sorting
  - radix
  - integer sorting
  - range reduction
  - word ram
complexity: n + n log(b / log n) for b-bit keys; extra space n + 2^(b/2)
related:
  - bucket-sort
  - counting-sort
  - lsd-radix-sort
---

Sort b-bit integers by range reduction: split every key into its high and low halves, group the keys by high half, and reduce the problem in linear time to sorting n keys of b/2 bits; repeat until the keys are short enough for a counting sort.

The trick at each level is that a group contributes its high half once and its other members' low halves, while its minimum is set aside; sorting that mixed list of half-length keys yields both the order of the groups and the order inside each group. The lower strips show the lists of each level as the key length halves.

Kirkpatrick and Reisch show that on a RAM with addition, subtraction and shifts, n integers from the range 0 to n^c can be sorted in time proportional to n log c + n. For b-bit words c is b / log n, which is how the bound above arises, and it beats radix sort, whose time for the same range grows like n·c. Start with Random permutation at n = 512 to see the recursion stop after a level or two, since the plate's keys are short.

It is above all a theoretical result: the bucket table of size 2^(b/2) is impractical for large words, which is why radix sort with a well-chosen base wins in practice. The kernel groups by direct addressing where the paper hashes for large words, and the method is not stable.
