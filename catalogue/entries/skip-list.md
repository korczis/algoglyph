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
---

Linked lists stacked in levels, each node promoted by a coin flip: search skips ahead.

A sorted linked list with express lanes: each node joins the next level up with probability p. A search starts on the top lane at the head and moves right while the next key is smaller, dropping a level whenever it would overshoot; an insert makes the same walk and then splices the new node into as many lanes as its coin flips gave it.

The expected number of comparisons grows about as (1/p) log_{1/p} n, which is 2 lg n for both p = 1/2 and p = 1/4, while p = 1/4 needs fewer links per node. The highlighted path is the walk of the latest operation.

Once the list reaches its size it keeps working: searches for stored and absent keys, deletions and inserts. The chart plots comparisons per insert as the list grows.
