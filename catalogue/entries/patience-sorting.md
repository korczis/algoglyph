---
id: patience-sorting
title: Patience sorting
taxonomy: sorting/trees
status: live
engine: array
labs:
  - sorting
sources:
  - id: aldous-1999
    ref: piles, the greedy strategy and longest increasing subsequences
  - id: mallows-1962
    ref: the game posed as a problem
  - id: mallows-1963
    ref: its solution
  - id: chandramouli-2014
    ref: patience sorting revisited for modern processors
tags:
  - sorting
  - piles
  - merging
  - adaptive
complexity: n best, n log n average and worst; extra space n
related:
  - binary-insertion-sort
  - insertion-sort
---

Deal the keys like cards onto piles, each onto the leftmost pile whose top card is at least as large, or onto a new pile at the right; every pile is then a sorted run, and a multiway merge of the piles gives the sorted output.

The tops of the piles increase from left to right, so the right pile for a card is found by binary search, much as binary insertion finds a position, except that it searches the tops of many piles instead of one sorted array. With p piles the dealing and the merge each cost about log p comparisons per key, n log p in all, which is n log n at worst.

The number of piles is exactly the length of the longest increasing subsequence of the input: the keys of an increasing subsequence must lie on different piles, and the greedy deal opens no more piles than that. This is the thread Aldous and Diaconis follow from the card game to Young tableaux and the Baik–Deift–Johansson theorem. Try Reversed at n = 64, which deals a single pile, against Already sorted, which deals one pile per key.

The game and its name come from Mallows's problem in SIAM Review in 1962, answered in 1963. Equal keys can end up on different piles and leave the merge in either order, so the sort is not stable; as a by-product of the deal it gives the longest increasing subsequence in n log n time.
