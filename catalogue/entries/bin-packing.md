---
id: bin-packing
title: Bin packing
taxonomy: systems/scheduling
status: live
engine: custom
sources:
  - id: practice-logistics
tags:
  - bin packing
  - next fit
  - first fit decreasing
motivation: Warehouse logistics spend most of their time on exactly this.
complexity: next fit O(n); first fit O(n · bins) as scanned here, O(n log n) with a tournament tree; first fit decreasing adds an O(n log n) sort
---

Next fit, first fit and first fit decreasing filling the same bins, and how many each needs.

Every item has an integer size and every bin the same capacity. The three heuristics pack the same items side by side: next fit keeps only its newest bin open, first fit puts each item into the earliest bin it fits, and first fit decreasing sorts the items largest first and then runs first fit. The readouts count bins, how full they are, and the fit tests each heuristic makes, recounted from the replayed placements.

Next fit makes one fit test per item, and because any two neighbouring bins together hold more than one bin's capacity it never needs as many as 2 Σ size / capacity + 1 bins. Halves and crumbs is its bad case: every half-full bin takes one crumb and then refuses the next half, so it uses nearly twice the bins of first fit decreasing, which pairs the halves.

First fit is never worse than ⌊1.7 · OPT⌋ bins, and first fit decreasing never worse than 11/9 · OPT + 6/9; both bounds are tight. This plate scans the bins in order, so its fit tests show the naive cost, which grows with the number of bins; a tournament tree over the free space finds the first bin that fits in logarithmic time.

No packing uses fewer bins than ⌈Σ size / capacity⌉, the lower bound beside the measured counts in the chart. Finding the optimum is NP-hard, so the plate searches for it exactly, by branch and bound, only on small inputs.
