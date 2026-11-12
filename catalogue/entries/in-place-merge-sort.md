---
id: in-place-merge-sort
title: Mergesort, in place
taxonomy: sorting/mergesort
status: live
engine: array
labs:
  - sorting
sources:
  - id: katajainen-1996
    ref: the algorithm, and its comparison and move bounds
  - id: huang-1988
    ref: block merging, the alternative linear-time in-place merge
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
  worst: 'at most n log₂ n + O(n) comparisons and 3n log₂ n + O(n) moves, an exchange being three moves (Katajainen, Pasanen and Teuhola)'
claims:
  - id: no-auxiliary-write
    statement: >-
      On Random permutation at 512 keys the in-place mergesort makes no auxiliary write: every key moves by exchanges inside the array.
    readout: Auxiliary writes
    expect: { value: 0 }
    setup:
      params: { shape: random, n: 512, speed: 2000 }
---

Mergesort without an auxiliary array, after Katajainen, Pasanen and Teuhola: the part of the input not yet sorted serves as the work area, and a merge writes its output into that area by exchanges, so the keys the area held move to where the runs were and nothing is lost.

To sort a range it first sorts one half into the other half, which leaves the second half sorted and the first half free as work area. Then, round after round, it sorts half of the remaining unsorted part into the other half of it and merges that sorted piece with the sorted tail, using what is still unsorted as the work area; sorting into the area means sorting the two halves of the piece in place by the same method and merging them into it. Each round halves the unsorted part, and the last one or two keys are inserted by exchanges.

A merge into the work area compares the two front keys and exchanges the smaller one with the next cell of the area, so every write on the plate is half of an exchange and the Auxiliary writes stay at zero on every input. Start with Random permutation at n = 512 and compare the Array writes with mergesort-top-down: 18,186 against 4,608, the price of merging without a buffer. Already sorted is not the easy case: at 512 keys it costs 6,011 comparisons, Reversed 1,593.

The authors prove that this straightforward variant makes at most n log₂ n + O(n) comparisons and 3n log₂ n + O(n) moves, and give a more advanced variant whose moves fall to εn log₂ n for any fixed ε > 0. The price of the exchanges is stability: moving a key into the work area exchanges it with whatever the area held, which can carry it past an equal key, and even the two keys of [1, 1] come out reordered.

Other routes to in-place merging exist and are not what this plate runs. Huang and Langston merge two runs in linear time and constant space by cutting them into blocks of about √n keys and using one block as an internal buffer, and their later paper makes merging and sorting stable in constant space; SymMerge merges by rotations instead and pays n log² n time. Reach for an in-place mergesort only where extra memory is genuinely unavailable: with an auxiliary array, plain mergesort moves far fewer keys.
