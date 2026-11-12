---
id: bin-packing
title: Bin packing
taxonomy: systems/scheduling
status: live
engine: custom
sources:
  - id: practice-logistics
  - id: johnson-1974-packing-bounds
    ref: 'first fit decreasing within 11/9 · OPT + 4; lists on which first fit needs 17/10 · OPT'
  - id: dosa-sgall-2013-first-fit
    ref: '§3, first fit within ⌊1.7 · OPT⌋; §4, lists that reach it'
  - id: dosa-2007-ffd
    ref: 'first fit decreasing within 11/9 · OPT + 6/9, a tight additive constant'
tags:
  - bin packing
  - next fit
  - first fit decreasing
motivation: Warehouse logistics spend most of their time on exactly this.
complexity: next fit O(n); first fit O(n · bins) as scanned here, O(n log n) with a tournament tree; first fit decreasing adds an O(n log n) sort
---

Next fit, first fit and first fit decreasing filling the same bins, and how many each needs.

Every item has an integer size and every bin the same capacity. The three heuristics pack the same items side by side: next fit keeps only its newest bin open, first fit puts each item into the earliest bin it fits, and first fit decreasing sorts the items largest first and then runs first fit. The readouts count bins, how full they are, and the fit tests each heuristic makes: every placement records the fit tests it took, and the readout adds them up as the placements replay.

Next fit makes one fit test per item, and because any two neighbouring bins together hold more than one bin's capacity it never needs as many as 2 Σ size / capacity + 1 bins. Halves and crumbs is its bad case: every half-full bin takes one crumb and then refuses the next half, so it uses nearly twice the bins of first fit decreasing, which pairs the halves.

Johnson, Demers, Ullman, Garey and Graham (1974) bounded first fit decreasing by 11/9 · OPT + 4 and gave lists on which first fit needs 17/10 · OPT bins. Dósa and Sgall (2013, §3) proved first fit never needs more than ⌊1.7 · OPT⌋ bins, and gave lists that need exactly that many for most values of OPT (§4); Dósa (2007) proved first fit decreasing never needs more than 11/9 · OPT + 6/9, a constant no smaller one can replace. This plate scans the bins in order, so its fit tests show the naive cost, which grows with the number of bins; a tournament tree over the free space finds the first bin that fits in logarithmic time.

No packing uses fewer bins than ⌈Σ size / capacity⌉, the lower bound beside the measured counts in the chart. Finding the optimum is NP-hard, so the plate searches for it exactly, by branch and bound, only on small inputs.
