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
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites: [mergesort-natural, binary-insertion-sort]
  objectives:
  - 'Count Already sorted and Reversed: n − 1 comparisons each and no auxiliary write; Reversed adds 2⌊n/2⌋ array writes for the one reversal of a descending run.'
  - 'Count Organ pipe from 64 keys on: two runs and one merge, 2(n − 1) comparisons, the shorter run copied once in ⌊(n − 1)/2⌋ auxiliary writes.'
  - 'Read the Phase readout on Few distinct keys at 512 keys: the merges switch to galloping.'
  misconceptions:
  - 'Timsort beats mergesort on every input; on Random permutation at 512 keys its comparisons are within 10% of top-down mergesort''s, and its gain is on inputs with runs.'
algorithm:
  paradigm: divide-and-conquer
  properties:
    stable: true
    in_place: false
    comparison_based: true
bounds:
  model: 'comparisons, array writes (an exchange is two writes, a copy one) and auxiliary writes (the shorter run, copied for each merge)'
  best: 'n − 1 comparisons and no writes (Already sorted, keys all equal); n − 1 comparisons and 2⌊n/2⌋ array writes on Reversed, one strictly descending run reversed in place; no auxiliary write on either'
  average: 'O(n + n log ρ) for ρ runs (Auger et al.); Organ pipe from 64 keys on 2(n − 1) comparisons and ⌊(n − 1)/2⌋ auxiliary writes'
  worst: 'merge cost 3/2 nH + O(n), H the entropy of the run lengths (Jugé), so O(n log n)'
claims:
  - id: nearly-sorted-below-mergesort
    statement: >-
      On Nearly sorted at 512 keys Timsort makes fewer than ½ n lg n = 2,304 comparisons, the fewest top-down mergesort makes on any input of 512 keys.
    readout: Comparisons
    expect: { below: 2304 }
    setup:
      params: { shape: nearly-sorted, n: 512 }
---

Tim Peters's adaptive, stable natural mergesort: one left-to-right pass finds runs (reversing strictly descending ones), extends short runs to a minimum length with binary insertion, pushes them on a stack and merges neighbours whenever the stack's lengths break an invariant; merges gallop past long stretches won by one run.

Galloping is the part to watch. While merging it counts how often one run wins in a row; past a threshold it switches to exponential then binary search, finds where the next key of the other run belongs and copies the whole block before it at once, and the threshold adapts to how well galloping pays. On Already sorted the run detection alone finishes the job in n − 1 comparisons with no merge at all. Start with Nearly sorted at n = 256, then Organ pipe, and compare with mergesort-natural on the same keys.

Auger and colleagues proved the Python Timsort runs in O(n + n log ρ) time for ρ runs, which explains its speed on partly sorted data. Jugé sharpened that: the worst-case merge cost is 3/2 nH + O(n), where H is the entropy of the run lengths, and a matching lower bound shows the 3/2 is real; adaptive ShiversSort and powersort bring it down to nH + O(n).

It merges only adjacent runs, because merging non-adjacent ones could reorder equal keys, so it is stable; the temporary array holds up to n/2 keys. The original merge rule, by the author's own account the first thing that was not obviously wrong, did not actually keep its intended invariant: researchers found this while trying to verify it formally, the Python and Java versions were fixed by also checking the fourth run from the top, and CPython now merges by powersort's rule instead.
