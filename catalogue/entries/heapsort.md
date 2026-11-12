---
id: heapsort
title: Heapsort
taxonomy: sorting/priority-queues
status: live
engine: array
labs:
  - sorting
sources:
  - id: sedgewick-aic
    ref: "Part 3: Sorting"
tags:
  - sorting
  - heap
  - priority queue
  - in-place
complexity: 2 n lg n compares worst case, in place
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites: [binary-heap]
  objectives:
  - 'Run Reversed: the input is already a max-heap, so the construction makes n − 1 comparisons and no write before the first exchange.'
  - 'Read the Comparisons at 512 keys: 7,604 on Random permutation, 7,958 on Already sorted, and never more than 2n⌊lg n⌋ = 9,216 on any input.'
  - 'Explain why building the heap bottom-up costs fewer than 2n comparisons, while each of the n − 1 removals costs up to two per level.'
  misconceptions:
  - 'Sorted input makes heapsort faster; at 512 keys Already sorted costs 7,958 comparisons, more than the 7,604 of Random permutation.'
algorithm:
  paradigm: incremental
  properties:
    stable: false
    in_place: true
bounds:
  model: 'comparisons and array writes (every write is half of an exchange; no auxiliary write)'
  average: 'the heap construction at most 2n − 2ν(n) − e₂(n) < 2n comparisons (ν(n) the 1-bits of n, e₂(n) its trailing zero bits), reached by some permutation of every size up to 8, and n − 1 with no write on Reversed; keys all equal 3n − 6 comparisons and 2(n − 1) array writes for n ≥ 3'
  worst: 'at most 2n⌊lg n⌋ comparisons on any input'
claims:
  - id: sorted-costs-more
    statement: >-
      On Already sorted at 512 keys heapsort makes more than the 7,604 comparisons it needs on Random permutation.
    readout: Comparisons
    expect: { above: 7604 }
    setup:
      params: { shape: sorted, n: 512 }
---

Build a max-heap bottom-up, then repeatedly exchange the maximum to the end and restore the heap.

The first phase leaves a rough slope, largest keys towards the left; the second phase peels the maximum off the root and sinks the key that replaced it.

It never needs extra memory and never goes quadratic, but its long jumps across the array are why quicksort usually beats it in practice.
