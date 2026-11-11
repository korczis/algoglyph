---
id: batcher-merge-exchange
title: Batcher's merge exchange
taxonomy: sorting/networks
status: live
engine: array
labs:
  - sorting
sources:
  - id: sedgewick-aic
    ref: "Part 3: Sorting"
tags:
  - sorting
  - sorting network
  - parallel
  - oblivious
complexity: O(n log² n) compare-exchanges, fixed in advance
related:
  - perfect-shuffle-merge
---

Batcher's odd-even merge exchange: a fixed schedule of compare-exchanges that sorts any input.

The sequence of comparisons does not depend on the keys, which is what makes it a network: every compare-exchange of one round could run on its own processor.

Try Already sorted: it performs exactly the same comparisons as on random input.
