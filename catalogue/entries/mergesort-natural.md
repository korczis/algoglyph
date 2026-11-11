---
id: mergesort-natural
title: Natural mergesort
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
  - adaptive
  - runs
complexity: linear on sorted input, n lg n at worst
related:
  - mergesort-bottom-up
---

Find the ascending runs the input already has, and merge neighbouring runs until one is left.

On Nearly sorted input there are few runs and a few merges finish the job; on Reversed input every run has length one and it behaves like bottom-up mergesort.
