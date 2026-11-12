---
id: weak-heapsort
title: Weak-heapsort
taxonomy: sorting/priority-queues
status: live
engine: array
labs:
  - sorting
sources:
  - id: dutton-1993
    ref: the original description
  - id: edelkamp-2000
    ref: analysis of its comparison count
  - id: knuth-taocp-3
    ref: the information-theoretic lower bound
  - id: sedgewick-2011
    ref: "Chapter 2: Sorting"
tags:
  - sorting
  - heap
  - priority queue
  - comparison-efficient
complexity: n log n in every case; extra space n bits
related:
  - bottom-up-heapsort
  - heapsort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites: [heapsort]
  objectives:
  - 'Read the Phase readout and count the build: exactly n − 1 comparisons, one join for every key but the root.'
  - 'Compare with bottom-up heapsort on Random permutation at 512 keys: 4,358 comparisons against 4,764, and heapsort''s 7,604.'
  - 'Explain why no input of 512 keys costs more than (n − 1)⌈lg n⌉ − 2^⌈lg n⌉ + n = 4,599 comparisons.'
  misconceptions:
  - 'The relaxed order of a weak heap costs extra comparisons when sorting; it is what lets every sorting step spend one comparison per level, so no input costs more than n lg n + 0.09n.'
algorithm:
  paradigm: incremental
  properties:
    stable: false
    in_place: false
    comparison_based: true
bounds:
  model: 'comparisons and array writes (an exchange is two writes); the Auxiliary writes redraw the reverse bits'
  average: 'building the weak heap exactly n − 1 comparisons on every input'
  worst: 'at most (n − 1)⌈lg n⌉ − 2^⌈lg n⌉ + n ≤ n lg n + 0.09n comparisons, reached by keys all equal at every n and by some permutation of every size up to 8'
claims:
  - id: random-below-bottom-up
    statement: >-
      On Random permutation at 512 keys weak-heapsort makes fewer than the 4,764 comparisons bottom-up heapsort makes on the same keys.
    readout: Comparisons
    expect: { below: 4764 }
    setup:
      params: { shape: random, n: 512, speed: 2000 }
---

Heapsort on a weak heap: every node only has to dominate its right subtree, and one reverse bit per node decides which child counts as right, so flipping a bit swaps two subtrees without moving any data.

The relaxed order is what makes it cheap. Joining a node with its distinguished ancestor costs a single comparison: if the node is larger, the two keys are exchanged and the node's bit is flipped. Building the weak heap takes exactly n − 1 such joins, and every sorting step afterwards walks one path of logarithmic length with one comparison per node, where classical heapsort spends about two.

Dutton introduced the structure and the sort; Edelkamp and Wegener analysed how close its comparison count comes to the lower bound log₂ n! that binds every comparison sort. The price is the reverse bits: n extra bits rather than a constant number of words, so it is not in place in the strict sense.

Start with Random permutation at n = 128 and set it against heapsort and bottom-up heapsort in the lab: the comparison counter separates them even when the finishing order does not. It is neither stable nor adaptive, and standard libraries do not use it: with cheap comparisons, quicksort and mergesort win on memory locality.
