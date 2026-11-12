---
id: bottom-up-heapsort
title: Bottom-up heapsort
taxonomy: sorting/priority-queues
status: live
engine: array
labs:
  - sorting
sources:
  - id: wegener-1993
    ref: the original description and its comparison bounds
  - id: williams-1964
    ref: classical heapsort
  - id: cormen-2022
    ref: "Chapter 6: Heapsort"
  - id: edelkamp-2000
    ref: comparison with weak-heapsort
tags:
  - sorting
  - heap
  - priority queue
  - in-place
complexity: n log n in every case; extra space 1
related:
  - binary-heap
  - heapsort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites: [heapsort]
  objectives:
  - 'Compare the Comparisons with heapsort on Random permutation at 512 keys: 4,764 against 7,604, below n lg n + n = 5,120.'
  - 'Run Already sorted at 512 keys: 4,771 comparisons, no fewer than on Random permutation; no input goes below Σ_{m=2}^{n−1}⌊lg m⌋.'
  - 'Explain why the heap after every step is the one classical sift-down leaves, though far fewer comparisons find it.'
  misconceptions:
  - 'Bottom-up heapsort moves the keys differently from heapsort; after every extraction its heap is classical heapsort''s, and only the comparisons that find the place are fewer.'
algorithm:
  paradigm: incremental
  properties:
    stable: false
    in_place: true
    comparison_based: true
bounds:
  model: 'comparisons and array writes (the exchange of the root with the last key is two writes, each shift along the path one)'
  best: 'never fewer than Σ_{m=2}^{n−1}⌊lg m⌋ comparisons: every extraction walks to a leaf and climbs back at least once'
  average: 'on Random permutation at 512 keys fewer than n lg n + n = 5,120 comparisons and below 0.65 of heapsort''s on the same keys, on every seed tested'
  worst: 'at most 1.5 n log n + O(n) comparisons (Wegener)'
claims:
  - id: random-below-n-lg-n-plus-n
    statement: >-
      On Random permutation at 512 keys bottom-up heapsort makes fewer than n lg n + n = 5,120 comparisons, where heapsort makes 7,604.
    readout: Comparisons
    expect: { below: 5120 }
    setup:
      params: { shape: random, n: 512, speed: 2000 }
---

Heapsort with a cheaper sift-down: after the root is exchanged with the last key, walk down the path of larger children to a leaf with one comparison per level, then climb back up to find where the displaced key belongs.

Classical heapsort spends two comparisons on every level: the two children against each other, then the larger child against the key being sifted. But the key that arrives at the root comes from the end of the array and is usually small, so it ends up near the leaves anyway. Wegener's variant defers that second comparison to a short climb back up the remembered path; the resulting heap is exactly the one classical sift-down would build.

Wegener proved at most 1.5 n log n + O(n) comparisons in the worst case, against roughly 2 n log n for classical heapsort, and his paper's title states its claim: on average it beats quicksort in comparisons once n is not very small. Run Random permutation at n = 256 in the sorting lab next to heapsort and compare the comparison counters, not only the finishing order.

It pays where comparisons are expensive, such as long strings or composite keys compared through a user function; with cheap integer keys memory traffic dominates and both versions behave alike. It keeps heapsort's other properties: in place, not stable, and not adaptive, so Already sorted brings no speed-up. Weak-heapsort takes the saving of comparisons further at the price of one extra bit per key.
