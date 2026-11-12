---
id: gnome-sort
title: Gnome sort
taxonomy: sorting/elementary
status: live
engine: array
labs:
  - sorting
sources:
  - id: grune-gnomesort
    ref: the name and the garden-gnome description
  - id: knuth-taocp-3
    ref: "5.2.1 Sorting by insertion"
  - id: cormen-2022
    ref: "Chapter 2: insertion sort"
tags:
  - sorting
  - quadratic
  - stable
  - in-place
  - adaptive
  - inversions
complexity: n best, n² average and worst; extra space 1
related:
  - bubble-sort
  - insertion-sort
  - shaker-sort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  prerequisites:
  - insertion-sort
  objectives:
  - 'Read the Array writes as twice the inversions: each exchange of neighbours removes exactly one.'
  - 'Count the comparisons between twice the inversions and twice the inversions plus n − 1, the extra ones from the walk forward over keys already seen.'
  - 'Compare with insertion sort on Nearly sorted to see the price of exchanges instead of shifts.'
  misconceptions:
  - 'Gnome sort is a method of its own; it removes the same inversions as insertion sort, one exchange each.'
algorithm:
  paradigm: incremental
  properties:
    stable: true
    in_place: true
    comparison_based: true
bounds:
  model: 'comparisons and array writes (an exchange is two writes)'
  best: 'n − 1 comparisons and no writes (Already sorted)'
  average: 'on every input, array writes = 2 × inversions, and 2 × inversions ≤ comparisons ≤ 2 × inversions + n − 1'
  worst: 'n(n − 1) comparisons and n(n − 1) array writes (Reversed)'
---

One index and one rule: if the key before it is not larger, step forward; otherwise exchange the pair and step back. The sort is done when the index walks off the end.

It is insertion sort written without an inner loop. A key that is out of place is exchanged leftwards until it finds its slot, and the index then walks forward again over keys it has already seen. Every exchange of neighbours removes exactly one inversion, so the exchange count equals the number of inversions of the input, and the comparisons are about twice that plus n.

Start with Nearly sorted at n = 64: the index runs straight ahead and dips back only where a key is misplaced, which is where its adaptivity shows. Reversed at the same size is the worst case, with every pair inverted and the index stepping back as far as it can each time.

Equal neighbours count as in order, so equal keys are never exchanged and the sort is stable. Beside insertion sort it loses on writes: a full exchange per inversion instead of a single shift, and a walk back over sorted keys that insertion sort skips. Remembering where the backward walk started and jumping there afterwards turns it into insertion sort exactly.
