---
id: skip-list
title: Skip list
taxonomy: searching/balanced-trees
status: live
engine: custom
sources:
  - id: sedgewick-aic
    ref: "Part 4: Searching"
tags:
  - skip list
  - randomized
  - linked lists
complexity: 'O(log n) expected comparisons per search, insert and delete; 1/(1 − p) links per node on average'
related:
  - bst-search-insert
  - randomized-bst
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
  - Search a sorted linked list with express lanes, moving right and dropping a level before overshooting.
  - Promote each node one level up with probability p, by a coin flip.
  - 'Compare p = 1/2 and p = 1/4: about 2 lg n comparisons for both, fewer links per node at 1/4.'
algorithm:
  paradigm: randomized
bounds:
  model: key comparisons
  average: 'expected about (1/p) log_{1/p} n, which is 2 lg n for p = 1/2 and for p = 1/4'
claims:
  - id: links-in-all
    statement: >-
      After 300 operations at p = 1/2 (the build of 48 keys, then searches, insertions and removals)
      the default seed's list holds 97 links over its nodes, recomputed by a skip list written in
      the test from the same coin flips.
    readout: Links in all
    expect: { value: 97 }
    setup:
      params: { runs: 300 }
  - id: keys-after-300-operations
    statement: >-
      After the same 300 operations the list holds 51 keys: past the target of 48 a removal and an
      insertion are equally likely, so the size drifts, recomputed by a skip list written in the
      test.
    readout: Keys
    expect: { value: 51 }
    setup:
      params: { runs: 300 }
  - id: comparisons-in-all
    statement: >-
      The same 300 operations make 4390 key comparisons in all, each operation's lookup and an
      insertion's or removal's second walk included, recomputed by Pugh's level-by-level walk
      written in the test.
    readout: Comparisons in all
    expect: { value: 4390 }
    setup:
      params: { runs: 300 }
  - id: links-per-node-half
    statement: >-
      A node rises a level with chance p, so its height is geometric with mean 1 / (1 − p) = 2 at p
      = 1/2. After 300 operations the mean height stays within [1.58, 2.42] at every seed of the
      fixed seed set 1–5: the band is 2 ± 3 SD, the SD 0.135 of the per-run mean over the disjoint
      seeds 101–130 (fixed before they were run; their mean 1.99), widened by display rounding.
    readout: Links per node
    expect: { range: [1.58, 2.42] }
    setup:
      params: { runs: 300 }
      seeds: [1, 2, 3, 4, 5]
  - id: links-per-node-quarter
    statement: >-
      At p = 1/4 the mean height is 1 / (1 − p) = 4/3. After 300 operations it stays within [1.05,
      1.61] at every seed of the fixed seed set 1–5: 4/3 ± 3 SD, the SD 0.090 of the per-run mean
      over the disjoint seeds 101–130 (their mean 1.34), widened by display rounding.
    readout: Links per node
    expect: { range: [1.05, 1.61] }
    setup:
      params: { runs: 300, p: '0.25' }
      seeds: [1, 2, 3, 4, 5]
---

Linked lists stacked in levels, each node promoted by a coin flip: search skips ahead.

A sorted linked list with express lanes: each node joins the next level up with probability p. A search starts on the top lane at the head and moves right while the next key is smaller, dropping a level whenever it would overshoot; an insert makes the same walk and then splices the new node into as many lanes as its coin flips gave it.

The expected number of comparisons grows about as (1/p) log_{1/p} n, which is 2 lg n for both p = 1/2 and p = 1/4, while p = 1/4 needs fewer links per node. The highlighted path is the walk of the latest operation.

Once the list reaches its size it keeps working: searches for stored and absent keys, deletions and inserts. The chart plots comparisons per insert as the list grows.
