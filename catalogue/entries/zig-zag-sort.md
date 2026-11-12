---
id: zig-zag-sort
title: Zig-zag sort
taxonomy: sorting/networks
status: live
engine: array
labs:
  - sorting
sources:
  - id: goodrich-2014
    ref: the original description and proof
  - id: ajtai-1983
    ref: the ε-halver it borrows
  - id: knuth-taocp-3
    ref: "5.2.2 Sorting by exchanging (merge exchange)"
tags:
  - sorting
  - sorting network
  - oblivious
  - in-place
  - shellsort
complexity: n log n (Goodrich); the plate's simplification n log² n comparators in depth on the order of n; extra space 1
related:
  - aks-sorting-network
  - batcher-merge-exchange
  - bitonic-sort
  - shellsort-knuth
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites: [aks-sorting-network]
  objectives:
  - 'Read the Rounds readout at 512 keys: 6,123, three matchings for each Reduce of a zig and a zag pass over the 2^i − 1 neighbouring pairs at each of nine levels, then the 45 rounds of Batcher''s merge exchange.'
  - 'Compare the comparators with Batcher''s merge exchange at the same n: the cleanup is exactly that network, so everything before it is the simplified zig-zag structure.'
  - 'Watch keys move between neighbouring subarrays as the levels halve them.'
  misconceptions:
  - 'Zig-zag sort is a shallow parallel network; even in this simplification its rounds grow with n, 6,123 at 512 keys against Batcher''s 45, and Goodrich notes that it is not a parallel algorithm.'
algorithm:
  properties:
    stable: false
    in_place: true
bounds:
  model: 'comparators (one comparison each, and an exchange of two writes when its keys are out of order) and rounds (one matching of a Reduce or one cleanup layer, its comparators disjoint); no auxiliary write'
  average: 'the same network on every input: 6·Σ_{i=1}^{⌊lg n⌋}(2^i − 1) + ⌈lg n⌉(⌈lg n⌉ + 1)/2 rounds, 6,123 at 512 keys, the last of them Batcher''s merge exchange comparator for comparator; no write on Already sorted'
claims:
  - id: rounds-grow-with-n
    statement: >-
      On Random permutation at 512 keys the plate's zig-zag sort takes 6,123 rounds: six for every neighbouring pair at each of nine levels, 6,078, then the 45 of Batcher's merge exchange that its uncertified halvers need as a cleanup.
    readout: Rounds
    expect: { value: 6123 }
    setup:
      params: { shape: random, n: 512, speed: 2000 }
---

Goodrich's deterministic, data-oblivious Shellsort variant: at each of log n levels the subarrays halve in size, and a zig pass left to right and a zag pass right to left apply a Reduce step to every pair of neighbouring subarrays.

Reduce is built from ε-halvers, the same block AKS uses, which pull the small keys into the left subarray and the large ones into the right. Because nothing depends on the keys, the whole procedure can be written as a network of size on the order of n log n, with constants Goodrich describes as large but far smaller than those of constructive AKS. The pseudocode is short; the proof of correctness is not, and rests on a system of potential functions.

The plate is a simplification and labels itself as one: each Reduce is a single halver made of fixed pseudo-random matchings, which are not certified, so Batcher's merge exchange cleans up at the end and guarantees a sorted result. The zig and zag passes over neighbouring subarrays are the real structure to watch. Start with Random permutation at n = 64 and look for keys bouncing between neighbouring blocks as the levels shrink.

Goodrich stresses that it is not a parallel algorithm: even as a network its time is on the order of n log n, not the logarithmic depth of AKS. Its use is privacy, sorting in oblivious RAM simulations where the access pattern must reveal nothing about the data; for ordinary sorting the constants make it slow.
