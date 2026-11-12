---
id: address-calculation-sort
title: Address calculation sort
taxonomy: sorting/distribution
status: live
engine: array
labs:
  - sorting
sources:
  - id: isaac-1956
    ref: the original description
  - id: flores-1960
    ref: analysis of the machine time
  - id: knuth-taocp-3
    ref: "5.2.1 Sorting by insertion"
  - id: cormen-2022
    ref: "Chapter 8: Sorting in linear time"
tags:
  - sorting
  - distribution
  - buckets
  - history
complexity: n on uniformly spread keys with a table to spare, n² worst; extra space n
related:
  - bucket-sort
  - insertion-sort
  - interpolation-sort
  - library-sort
  - proxmap-sort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites: [insertion-sort]
  objectives:
  - 'Run Random permutation at 512 keys: 1,013 comparisons, 2n − m − M for its m left-to-right minima and M maxima, since no two addresses of 1..n collide and every key compares once with the nearest stored key on each side.'
  - 'Run Already sorted and Reversed: n − 1 comparisons each, since every new key has a stored neighbour on one side only.'
  - 'Run Few distinct keys at 512 keys: 25,911 comparisons, since equal keys share an address and each new copy walks past the copies stored before it.'
  misconceptions:
  - 'A distribution sort stays linear when there are only a few key values; on Few distinct keys at 512 keys address calculation makes 25,911 comparisons, more than twenty times the 1,013 of Random permutation.'
algorithm:
  properties:
    in_place: false
bounds:
  model: 'comparisons (with the nearest stored keys while a key finds its place in the table) and array writes (the table read out, one per key); the auxiliary writes count the cells of the drawn table strip that change'
  best: 'n − 1 comparisons on Already sorted and on Reversed'
  average: 'n array writes on every input with two distinct keys or more; on a permutation of 1..n exactly 2n − m − M comparisons, m and M its left-to-right minima and maxima, the first key counted in both'
  worst: 'every key value below the largest costs at least m(m − 1)/2 comparisons for its m copies; 25,911 on Few distinct keys at 512 keys, where that floor is 25,027'
claims:
  - id: equal-keys-go-quadratic
    statement: >-
      On Few distinct keys at 512 keys address calculation makes more than twenty times the 1,013 comparisons of Random permutation: equal keys share an address, and each new copy walks past the copies stored before it.
    readout: Comparisons
    expect: { above: 20260 }
    setup:
      params: { shape: few-unique, n: 512 }
---

Compute from each key its expected address in a table larger than the input and store it there; when the address is taken, shift neighbours towards the nearest empty cell so the occupied cells stay in key order; finally read the table out, skipping the gaps.

Isaac and Singleton published it in 1956, and Cormen and colleagues date bucket sorting from that paper. The address function is monotone, so keys land roughly in order and only collisions need comparisons and moves; the lower strip is the table, here twice as large as the input, filling in key order.

The cost is the length of the runs of occupied cells. With uniformly spread keys and room to spare the runs are short and the average time linear, which Flores analysed in detail as a function of table size in 1960; when keys cluster, one long run forms and each insertion shifts on the order of n keys, the quadratic case of insertion sort. Random permutation at n = 128 shows no collision at all: consecutive keys of 1..n land at least two cells apart, so each key compares only with its nearest stored neighbours; Few distinct keys shows the other extreme, equal keys sharing one address.

Today it matters mostly as the ancestor of bucket, interpolation and proxmap sorts, which precompute bucket sizes and so avoid the shifting. Leaving gaps for later insertions is also the idea behind library sort. The kernel places an equal key after those already stored, which keeps it stable, but that is a choice of the implementation, not of the method.
