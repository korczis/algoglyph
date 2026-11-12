---
id: in-place-merge-sort
title: Mergesort, in place
taxonomy: sorting/mergesort
status: live
engine: array
labs:
  - sorting
sources:
  - id: huang-1988
    ref: the linear-time in-place merge
  - id: huang-1992
    ref: the stable constant-space follow-up
  - id: kim-2004
    ref: SymMerge, the rotation-based alternative
  - id: knuth-taocp-3
    ref: "5.2.4 Sorting by merging"
tags:
  - sorting
  - merging
  - in-place
  - buffer
complexity: n log n in every case; extra space 1
related:
  - mergesort-top-down
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites: [mergesort-top-down]
  objectives:
  - 'Read the Auxiliary writes: none on any input; every Array write is half of an exchange.'
  - 'Compare the Array writes with mergesort-top-down on Random permutation at 512 keys: 18,186 against 4,608, the price of merging without a buffer.'
  - 'Count Already sorted and Reversed at 512 keys: 6,011 against 1,593 comparisons, Already sorted the dearer from 3 keys on.'
  misconceptions:
  - 'An in-place mergesort is still stable; this one exchanges keys with its work area and reorders even the two equal keys of [1, 1].'
algorithm:
  paradigm: divide-and-conquer
  properties:
    stable: false
    in_place: true
    comparison_based: true
bounds:
  model: 'comparisons, array writes (an exchange is two writes) and auxiliary writes'
  average: 'no auxiliary write on any input, every array write half of an exchange; more comparisons on Already sorted than on Reversed from 3 keys on'
claims:
  - id: no-auxiliary-write
    statement: >-
      On Random permutation at 512 keys the in-place mergesort makes no auxiliary write: every key moves by exchanges inside the array.
    readout: Auxiliary writes
    expect: { value: 0 }
    setup:
      params: { shape: random, n: 512, speed: 2000 }
---

Bottom-up mergesort without the auxiliary array: every merge of two neighbouring runs happens inside the input itself, with a constant number of extra variables, using Huang and Langston's block merge.

Each merge cuts the two runs into blocks of about √n keys, borrows one block as an internal buffer, reorders the other blocks by their last keys and merges them by exchanging with the buffer; finally the buffer is sorted and put back. Every write is an exchange within the array, so the auxiliary strip stays empty while ordinary mergesort fills it on every pass. Start with Random permutation at n = 128 and compare the write count with mergesort-top-down.

The merge is linear and constant-space, so log n merge levels give n log n in every case. The price is stability: exchanges with the buffer reorder equal keys, so this formulation is not stable. Huang and Langston's later paper makes merging and sorting stable in constant space, at the cost of more intricate steps such as building the buffer from distinct keys; SymMerge takes another route, rotations instead of a buffer, and pays n log² n time.

Short runs are merged by simple rotations, because the block bookkeeping does not pay for itself there; on long runs rotations would be quadratic, which is the whole reason for the buffer. Reach for it only where extra memory is genuinely unavailable: with an auxiliary array, plain mergesort moves fewer keys.
