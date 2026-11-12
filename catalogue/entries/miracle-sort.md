---
id: miracle-sort
title: Miracle sort
taxonomy: sorting/esoteric
status: live
engine: custom
sources:
  - id: knuth-1997
    ref: "1.1 Algorithms: finiteness"
  - id: ziegler-1979
    ref: soft errors caused by cosmic rays
  - id: cormen-2022
    ref: the sorting problem asks for a permutation of the input
tags:
  - sorting
  - esoteric
  - in-place
  - non-terminating
complexity: n best, unbounded average and worst; extra space 1
related:
  - bogosort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  prerequisites: [bogosort]
  objectives:
  - 'Read comparisons in the last check: the position of the first descent, the same at every check.'
  - 'Read writes and swaps to the array: 0, after any number of checks.'
  - 'Choose Already sorted: one check of n − 1 comparisons, and the run is over.'
  misconceptions:
  - 'Waiting long enough sorts the array; every check finds the same descent, because nothing ever writes to it.'
algorithm:
  properties:
    stable: true
  postconditions:
    - The array equals its input after every check.
bounds:
  model: 'checks, comparisons per check and in all, and writes and swaps to the array'
  best: 'Already sorted: one check, n − 1 comparisons and no write'
  worst: 'every unsorted input: each check compares up to the first descent and writes nothing, and no number of checks ends the run (test/plate-miracle-sort.test.ts)'
claims:
  - id: nothing-is-ever-written
    statement: >-
      On Random permutation at 24 keys, with 240 frames between checks, miracle sort has written nothing to the array when its first check ends: 0 writes and swaps.
    readout: writes and swaps to the array
    expect: { value: 0 }
    setup:
      params: { shape: random, n: 24, wait: 240 }
---

Test whether the array is sorted; if not, wait for a miracle and test again, forever, without ever writing to the array.

The miracle is usually cosmic rays flipping exactly the right bits. Soft errors in memory caused by cosmic radiation are real, as Ziegler and Lanford described, but a flipped bit changes a value, not an order: even if the test eventually passed, the output would in general not be a permutation of the input, which is what the sorting problem demands.

It fails the definition of an algorithm as well. Knuth requires finiteness, termination after finitely many steps on every input, and calls a procedure without it a computational method. On every unsorted input miracle sort runs forever, and since it has no random step there is not even the probability-one termination that bogosort enjoys. On Already sorted it is a correct linear sortedness test: n − 1 comparisons and done.

This is a bespoke plate: miracle sort never sorts an unsorted input, so it cannot pass the array harness, which demands a sorted permutation. The plate shows the check sweeping the array, stopping at the first descent, waiting as long as the reader sets and starting again, with a counter of fruitless checks; after each check it compares the array with its input key by key and recounts the inversions, and the chart shows the comparisons per check, the inversions and the writes, all flat. The reader picks the input shape, and only Already sorted lets it finish.

It is internet folklore without a citable author or date. Its use is in teaching two definitions in one breath, of an algorithm and of the sorting problem; Stalin sort breaks the second one from the other side, returning sorted output that is not a permutation.
