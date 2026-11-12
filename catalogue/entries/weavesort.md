---
id: weavesort
title: Weave merge sort
taxonomy: sorting/hybrid
status: live
engine: array
labs:
  - sorting
sources:
  - id: w0rthy-2019
    ref: the only description, its source code
  - id: knuth-taocp-3
    ref: "5.2.1 Sorting by insertion"
tags:
  - sorting
  - hybrid
  - quadratic
  - in-place
  - interleaving
complexity: n best, n² worst; extra space log n
related:
  - in-place-merge-sort
  - insertion-sort
  - mergesort-top-down
  - shellsort-knuth
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites: [mergesort-top-down, insertion-sort]
  objectives:
  - 'Run Already sorted: every merge stops after comparing the last key of its left half with the first of its right, n − 1 comparisons and no write.'
  - 'Run Reversed at 512 keys: 70,657 comparisons, n²/4 + (5/4) n lg n − 5n/4 + 1, because every weave leaves m(m + 1)/2 inversions for the insertion pass when one half of m keys lies entirely above the other.'
  - 'Compare the Array writes of Random permutation and Reversed at 64 keys, and explain why the insertion pass costs one exchange per inversion the weave leaves.'
  misconceptions:
  - 'Interleaving two sorted halves leaves the result nearly sorted; when one half lies entirely above the other the weave leaves m(m + 1)/2 inversions, and Reversed at 512 keys costs 70,657 comparisons.'
algorithm:
  paradigm: divide-and-conquer
  properties:
    stable: false
    in_place: true
    comparison_based: true
bounds:
  model: 'comparisons and array writes (every write is half of an exchange: the weave rotates by reversals, the insertion pass exchanges neighbours); no auxiliary write'
  best: 'n − 1 comparisons and no write on Already sorted and on keys all equal'
  worst: 'quadratic: Reversed at n = 2^k costs n²/4 + (5/4) n lg n − 5n/4 + 1 comparisons and n²/2 + (n/2) lg n (lg n − 1) array writes, 70,657 and 149,504 at 512 keys'
claims:
  - id: reversed-is-quadratic
    statement: >-
      On Reversed at 512 keys weave merge sort makes exactly n²/4 + (5/4) n lg n − 5n/4 + 1 = 70,657 comparisons: every merge weaves a half that lies entirely above the other, which leaves m(m + 1)/2 inversions for the insertion pass.
    readout: Comparisons
    expect: { value: 70657 }
    setup:
      params: { shape: reversed, n: 512, speed: 2000 }
---

A mergesort whose merge is replaced: sort both halves recursively and, unless they are already in order, interleave them like the teeth of two combs so that keys of the left and right halves alternate, and let insertion sort tidy the nearly sorted result.

The only source is the code in the ArrayV sorting visualiser, where it is filed among the hybrid sorts; no paper or analysis has been published, so every bound here is read off the kernel and measured on the plate. The kernel weaves by recursive block rotations, at a cost in exchanges that depends on the length of the halves alone, and first compares the last key of the left half with the first of the right: when they are in order the merge stops there. Already sorted therefore costs n − 1 comparisons and no write.

The final insertion pass costs one exchange per inversion left by the interleaving. That is the lesson of the plate: when one half lies entirely above the other, the weave leaves m(m + 1)/2 inversions for halves of m keys, so Reversed at n = 2^k costs n²/4 + (5/4) n lg n − 5n/4 + 1 comparisons, 70,657 at 512 keys. Run it at n = 64 on Reversed and then on Random permutation, and compare the write counters.

It works in place with recursion depth log n and is not stable: the interleaving changes the relative order of keys from different halves. It has no practical use; it belongs with Shellsort as an illustration that insertion sort is cheap only on input with few inversions.
