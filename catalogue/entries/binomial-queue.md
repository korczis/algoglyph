---
id: binomial-queue
title: Binomial queue
taxonomy: sorting/priority-queues
status: live
engine: tree
sources:
  - id: sedgewick-aic
    ref: "Part 3: Sorting"
tags:
  - priority queue
  - binomial trees
  - mergeable
complexity: lg n per insert, remove-max and join
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites: [binary-heap]
  objectives:
  - 'Count the comparisons of the inserts: n − ν(n) for n keys, 247 for 255, one per link; the k-th insert makes as many as k − 1 has trailing 1-bits.'
  - 'Read Cost per insert: below one comparison on average, though a single insert can cost up to ⌊lg n⌋.'
  - 'Explain why a remove-max of m keys costs at most 2⌊lg m⌋ comparisons: ν(m) − 1 to scan the roots, then the links that merge the children back.'
  misconceptions:
  - 'Every insert into a logarithmic queue costs about lg n comparisons; n inserts make n − ν(n) in all on every input, fewer than one each.'
bounds:
  model: 'key comparisons (one per link of two trees) and links written (each new child link, and each root slot emptied or filled)'
  average: 'n inserts on every input: n − ν(n) comparisons and n + 2(n − ν(n)) links written, ν(n) the 1-bits of n'
  worst: 'the k-th insert as many comparisons as k − 1 has trailing 1-bits, so at most ⌊lg n⌋; a remove-max of m keys between ν(m) − 1 and ν(m) − 1 + ⌊lg m⌋ − e₂(m) ≤ 2⌊lg m⌋ comparisons'
claims:
  - id: inserts-below-one-comparison
    statement: >-
      On Random order at 255 keys an insert costs fewer than one comparison on average: the 255 inserts make n − ν(n) = 247.
    readout: Cost per insert
    expect: { below: 1 }
    setup:
      params: { shape: random, n: 255 }
---

A forest of power-of-two trees that merges like binary addition.

Root slot k holds a heap-ordered tree of exactly 2^k keys, or nothing, so the occupied slots spell the number of keys in binary. Linking two trees of the same order makes the smaller root the first child of the larger: one comparison and one new child link. The Links written readout also counts every root slot the queue empties or fills, so n inserts write n + 2(n − ν(n)) links for their n − ν(n) comparisons, 749 for 247 at 255 keys.

An insert adds a one-node queue to the slots, carrying like binary addition. A remove-max scans the roots, takes the largest, and merges its children back in, since the children of a root of order k are trees of orders k-1 down to 0. The plate inserts every key, then removes them all; the strip shows the maxima as they come out.
