---
id: timsort
title: Timsort
taxonomy: sorting/mergesort
status: live
engine: array
labs:
  - sorting
sources:
  - id: peters-2002
    ref: the author's description of list.sort
  - id: auger-2018
    ref: the worst-case analysis
  - id: juge-2020
    ref: the 3/2 nH + O(n) merge cost and the fixed invariant
  - id: buss-2019
    ref: lower bounds and comparison with other strategies
tags:
  - sorting
  - merging
  - stable
  - adaptive
  - runs
  - galloping
complexity: n best, n log n average and worst; extra space n
related:
  - adaptiveshiverssort
  - binary-insertion-sort
  - mergesort-natural
  - mergesort-top-down
  - peeksort
  - powersort
  - shiverssort
motivation: Python's list sort and Java's sort for object arrays were built on it.
---

Tim Peters's adaptive, stable natural mergesort: one left-to-right pass finds runs (reversing strictly descending ones), extends short runs to a minimum length with binary insertion, pushes them on a stack and merges neighbours whenever the stack's lengths break an invariant; merges gallop past long stretches won by one run.

Galloping is the part to watch. While merging it counts how often one run wins in a row; past a threshold it switches to exponential then binary search, finds where the next key of the other run belongs and copies the whole block before it at once, and the threshold adapts to how well galloping pays. On Already sorted the run detection alone finishes the job in n − 1 comparisons with no merge at all. Start with Nearly sorted at n = 256, then Organ pipe, and compare with mergesort-natural on the same keys.

Auger and colleagues proved the Python Timsort runs in O(n + n log ρ) time for ρ runs, which explains its speed on partly sorted data. Jugé sharpened that: the worst-case merge cost is 3/2 nH + O(n), where H is the entropy of the run lengths, and a matching lower bound shows the 3/2 is real; adaptive ShiversSort and powersort bring it down to nH + O(n).

It merges only adjacent runs, because merging non-adjacent ones could reorder equal keys, so it is stable; the temporary array holds up to n/2 keys. The original merge rule, by the author's own account the first thing that was not obviously wrong, did not actually keep its intended invariant: researchers found this while trying to verify it formally, the Python and Java versions were fixed by also checking the fourth run from the top, and CPython now merges by powersort's rule instead.
