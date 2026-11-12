---
id: american-flag-sort
title: American flag sort
taxonomy: sorting/radix
status: live
engine: array
labs:
  - sorting
sources:
  - id: mcilroy-1993
    ref: the original description
  - id: sedgewick-2011
    ref: "5.1 String sorts"
tags:
  - sorting
  - radix
  - in-place
  - msd
complexity: about n log_R n characters examined on random keys, n·w worst for w-byte keys; extra space w·R counters
related:
  - binary-quicksort
  - lsd-radix-sort
  - msd-radix-sort
  - quicksort-three-way
  - three-way-radix-quicksort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites: [msd-radix-sort]
  objectives:
  - 'Run Random permutation at 512 keys: no comparison at all and 1,516 array writes, since every pile of the last byte holds a single key.'
  - 'Run Already sorted: no write, since every key already lies in its pile and no cycle starts.'
  - 'Explain why a pile of fewer than 16 keys goes to insertion sort, the only place the plate counts a comparison, and why on 1..n only 257 to 270 keys leave such a pile.'
  misconceptions:
  - 'An in-place radix sort has to compare keys to find their places; on Random permutation at 512 keys American flag sort makes 1,516 array writes and no comparison.'
algorithm:
  paradigm: divide-and-conquer
  properties:
    stable: false
    in_place: true
bounds:
  model: 'comparisons (only in the insertion sort of piles under 16 keys) and array writes (each exchange two); no auxiliary write'
  best: 'no write on Already sorted, and from 16 keys no comparison there either, unless a block of 256 keys (keys agreeing on all but the lowest byte) holds 2 to 15 of them, m − 1 comparisons for its m'
  average: 'no comparison on a permutation of 1..n for 16 ≤ n ≤ 512, except 257 ≤ n ≤ 270; 1,516 array writes on Random permutation at 512 keys'
claims:
  - id: random-no-comparison
    statement: >-
      On Random permutation at 512 keys American flag sort makes no comparison: every pile of the lowest byte holds one key, so no pile reaches the insertion sort.
    readout: Comparisons
    expect: { value: 0 }
    setup:
      params: { shape: random, n: 512 }
---

An in-place MSD radix sort: count how many keys fall into each of the 256 piles of the current byte, compute where the piles begin, permute the keys home by following cycles, then sort every pile on the next byte.

The name is McIlroy, Bostic and McIlroy's joke: with two piles the step is quicksort's partition, with three it is Dijkstra's Dutch national flag, so the many-striped general case is the American flag. Watch the permutation phase: a key is swapped into the next free slot of its pile, the key it displaces goes to its own pile, and the cycle runs until a key of the starting pile comes back.

Each level reads every key once to count it and moves it at most once, so the total work is the number of characters examined, the same as for MSD radix sort, but without an auxiliary array of n keys. Small piles are finished by insertion sort, as the paper recommends, because a table of 256 counters does not pay for a few keys.

Start with Random permutation at n = 256. The plate's keys are at most 512, so only the low bytes differ and the work concentrates in the last passes. The cycles do not keep equal keys in order, so it is not stable; when stability matters, LSD radix sort or a two-array MSD sort is the choice.
