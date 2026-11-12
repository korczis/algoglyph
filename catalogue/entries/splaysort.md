---
id: splaysort
title: Splaysort
taxonomy: sorting/trees
status: live
engine: array
labs:
  - sorting
sources:
  - id: moffat-1996
    ref: splaysort described and measured
  - id: sleator-1985
    ref: splay trees and their amortised bound
  - id: estivill-castro-1992
    ref: measures of presortedness
tags:
  - sorting
  - search tree
  - self-adjusting
  - adaptive
  - online
complexity: n best, n log n average and worst; extra space n
related:
  - avl-tree-sort
  - insertion-sort
  - splay-tree
  - tree-sort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites: [tree-sort, splay-tree]
  objectives:
  - 'Run Already sorted or Reversed at 64 keys: 63 comparisons, n − 1, since each new key lands beside the root, where the last splay left its neighbour.'
  - 'Run Organ pipe at 64 keys: 125 comparisons, 2n − 3, against 2,016 for plain tree sort on Already sorted.'
  - 'Compare Nearly sorted with Random permutation at 512 keys: 597 comparisons against 5,135.'
  misconceptions:
  - 'A tree that rotates at every insertion must pay for the rotations in comparisons; the rotations compare nothing, and on Already sorted the whole sort costs n − 1 comparisons, the fewest any input can.'
algorithm:
  paradigm: incremental
  properties:
    in_place: false
    comparison_based: true
bounds:
  model: 'comparisons (one per node passed on the way down; the splay rotations compare nothing), array writes (the in-order walk) and auxiliary writes (one node per key)'
  best: 'n − 1 comparisons, the fewest of any input, on Already sorted, Reversed and keys all equal; 2n − 3 on Organ pipe'
  worst: 'O(n log n) amortised (Sleator and Tarjan); O(n log(1 + Inv/n)) for Inv inversions (Moffat, Eddy and Petersson)'
  space: 'n tree nodes: n auxiliary writes and n array writes on every input'
claims:
  - id: sorted-input-costs-n-minus-one
    statement: >-
      On Already sorted at 64 keys splaysort makes 63 comparisons, n − 1: every new key is compared only with the root, the key inserted before it.
    readout: Comparisons
    expect: { value: 63 }
    setup:
      params: { shape: sorted, n: 64 }
---

Tree sort into a splay tree: every inserted key is rotated to the root by zig, zig-zig and zig-zag steps, and an in-order walk reads the keys out sorted at the end.

A splay tree keeps no balance information at all. Splaying a node to the root also shortens the paths to the other nodes that lay on its access path, and Sleator and Tarjan proved that any sequence of m operations on a tree of at most n nodes costs O(m log n) amortised; for splaysort that means O(n log n) in the worst case, even though a single insertion can be expensive.

What splaysort gains is adaptivity: recently inserted keys sit near the root, so input that is close to sorted, or that revisits a few neighbourhoods, is cheap. Estivill-Castro and Wood's survey frames this through measures of disorder such as the number of inversions or runs, and Moffat, Eddy and Petersson presented splaysort in 1996 as a fast, versatile, practical adaptive sort. Compare Nearly sorted with Random permutation at n = 128 and read the comparison counts.

The price is a pointer-based tree with n nodes, so it does not work in place, and rotations preserve the in-order sequence, so stability depends only on where equal keys are sent. Unlike AVL tree sort it stores no balance factors, and its n log n bound is amortised rather than per operation.
