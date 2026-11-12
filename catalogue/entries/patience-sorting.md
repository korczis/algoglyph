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
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites: [binary-insertion-sort, binary-heap]
  objectives:
  - 'Read the Phase readout when the deal ends: on Random permutation at 64 keys it says collect from 12 piles, the length of the input''s longest non-decreasing subsequence.'
  - 'Run Reversed at 64 keys: one pile and 63 comparisons, n − 1; then Already sorted, which deals one pile per key.'
  - 'Read Array writes and Auxiliary writes: n each on every input, one card dealt and one key output.'
  misconceptions:
  - 'Already sorted input is the cheapest; it deals one pile per key and costs more than Random permutation, 10,798 comparisons against 7,584 at 512 keys, while Reversed costs 511.'
algorithm:
  paradigm: greedy
  properties:
    in_place: false
    comparison_based: true
  postconditions:
    - The number of piles is the length of the longest non-decreasing subsequence of the input.
bounds:
  model: 'comparisons (the binary search over the pile tops while dealing, then the heap of pile tops while collecting), array writes (one per key output) and auxiliary writes (one per card dealt)'
  best: 'n − 1 comparisons and a single pile on Reversed'
  average: 'P piles, P the longest non-decreasing subsequence; each key dealt with at most ⌈lg(P + 1)⌉ comparisons; n array writes and n auxiliary writes on every input'
  worst: 'O(n log P), at most O(n log n) (Aldous and Diaconis; Chandramouli and Goldstein)'
claims:
  - id: piles-are-the-longest-run
    statement: >-
      On Random permutation at 64 keys patience sorting deals 12 piles, the length of the input's longest non-decreasing subsequence, which the test computes from the input by itself.
    readout: Phase
    expect: { value: 12 }
    setup:
      params: { shape: random, n: 64 }
---

Deal the keys like cards onto piles, each onto the leftmost pile whose top card is larger, or onto a new pile at the right; every pile is then a sorted run, and a multiway merge of the piles gives the sorted output.

The tops of the piles never decrease from left to right, so the right pile for a card is found by binary search, much as binary insertion finds a position, except that it searches the tops of many piles instead of one sorted array. With p piles the dealing and the merge each cost about log p comparisons per key, n log p in all, which is n log n at worst.

The number of piles is exactly the length of the longest non-decreasing subsequence of the input, the longest increasing one when the keys are distinct: the keys of such a subsequence must lie on different piles, and the greedy deal opens no more piles than that. With the rule at least as large instead, equal keys would stack on one pile and the piles would count the longest strictly increasing subsequence. This is the thread Aldous and Diaconis follow from the card game to Young tableaux and the Baik–Deift–Johansson theorem. Try Reversed at n = 64, which deals a single pile, against Already sorted, which deals one pile per key.

The game and its name come from Mallows's problem in SIAM Review in 1962, answered in 1963. Patience sorting is not generally specified as stable; in the plate's kernel an equal key always goes to a pile further right and the merge breaks ties by pile, so no input its test searched had equal keys reordered. As a by-product of the deal it gives the longest increasing subsequence in n log n time.
