---
id: mergesort-top-down
title: Mergesort, top-down
taxonomy: sorting/mergesort
status: live
engine: array
labs:
  - sorting
sources:
  - id: sedgewick-aic
    ref: "Part 3: Sorting"
tags:
  - sorting
  - mergesort
  - stable
  - divide and conquer
  - auxiliary memory
complexity: at most n lg n compares, n extra space
---

Sort each half recursively, then merge the two sorted halves.

The lower strip is the auxiliary array: each merge copies its range there and writes the merged keys back.

Comparisons barely depend on the input, writes not at all: mergesort is the predictable one.
