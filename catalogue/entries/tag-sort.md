---
id: tag-sort
title: Tag sort
taxonomy: sorting/special
status: live
engine: array
labs:
  - sorting
sources:
  - id: knuth-taocp-3
    ref: "5.2 Internal sorting: address table sorting"
  - id: cormen-2022
    ref: satellite data and sorting pointers
tags:
  - sorting
  - special-purpose
  - indirect sorting
  - permutation
complexity: n log n comparisons with a comparison sort on the tags; at most n plus the number of cycles record moves; extra space n
related:
  - counting-sort
  - cycle-sort
  - external-merge-sort
  - mergesort-top-down
  - topological-sort
---

Sort a table of tags, small pairs of key and record address, instead of the records themselves; then either read the records through the sorted tags or rearrange them once by following the cycles of the permutation.

The point is size. When records are long and keys short, every exchange of whole records costs far more than swapping a pair of tags; Knuth calls this address table sorting, and Cormen and colleagues note that large records with satellite data are usually sorted by permuting pointers to them. Ties broken by the record's index make any tag sort stable.

The plate builds the tag array in the auxiliary strip, sorts it with a stable merge whose comparisons read the records' keys in place, and finally rearranges the records cycle by cycle. Start with Random permutation at n = 64 and compare the writes of the last phase with the writes of the sort before it: each record moves at most once, plus one held record per cycle.

It pays when records are large or must not move, or when several orders of the same file are needed at once, each just another tag array. It does not pay for small records such as bare numbers, where a tag is as large as the record, and reading through tags later visits memory or disk in scattered order, which can cost more than sorting the records directly.
