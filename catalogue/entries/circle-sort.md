---
id: circle-sort
title: Circle sort
taxonomy: sorting/elementary
status: live
engine: array
labs:
  - sorting
sources:
  - id: bezemer-circlesort
    ref: the author's description
  - id: knuth-taocp-3
    ref: "5.2.2 Sorting by exchanging"
tags:
  - sorting
  - in-place
  - exchange
  - recursion
complexity: n log n best, unknown average and worst; extra space log n
related:
  - bubble-sort
  - mergesort-top-down
  - odd-even-sort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
  - 'Count the sweeps in the Phase readout: every sweep makes the same comparisons, so the Comparisons readout is the sweeps times one sweep''s.'
  - 'See Already sorted cost one sweep and no writes, (n/2) lg n comparisons when n is a power of two.'
  - 'Watch Reversed turned round by the very first circle: two sweeps and 2⌊n/2⌋ array writes.'
  misconceptions:
  - 'The number of sweeps is known to be logarithmic; the author claims it without a proof, and no analysis bounds it.'
algorithm:
  paradigm: iterative-refinement
  properties:
    stable: false
    in_place: true
    comparison_based: true
bounds:
  model: 'comparisons, array writes (an exchange is two writes) and sweeps (the Phase readout)'
  best: 'one sweep and no writes (Already sorted); a sweep of n keys, n a power of two, makes (n/2) lg n comparisons'
  average: 'unknown; on every input, comparisons = sweeps × the comparisons of one sweep'
  worst: 'unknown'
---

Compare-exchange the first key with the last, the second with the second last, and so on to the middle; then do the same inside each half, down to single keys. Repeat whole sweeps until one makes no exchange.

The name comes from the author's diagrams, where the compared pairs form concentric circles. A segment of odd length has a middle key without a partner; the author's first version therefore sorted only lengths that are powers of two, and the fix compares the middle key with its right neighbour. Each exchange of an inverted pair, near or far, lowers the number of inversions by at least one, which is why the sweeps must eventually stop.

One sweep makes about (n/2) log n comparisons, so Already sorted costs a single sweep. Reversed is the showcase: the very first circle turns the whole array round. Start with Random permutation at n = 64 and count the sweeps, which is exactly the quantity nobody has bounded.

There is no peer-reviewed analysis. The author's page claims n log n log n, a logarithmic number of sweeps, without a proof, and the only easy upper bound from the inversion argument is very coarse; the average and worst case are therefore left unknown. It exchanges distant keys, so it is not stable, and the recursion needs a stack of depth log n.
