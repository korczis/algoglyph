---
id: path-compression
title: Weighted quick-union with path compression
taxonomy: foundations/connectivity
status: live
engine: tree
labs:
  - union-find
sources:
  - id: sedgewick-aic
    ref: "Part 1: Fundamentals"
tags:
  - union-find
  - amortised
complexity: O(m α(n)) array accesses for m operations
relations:
  - { type: improves_on, target: weighted-quick-union, reason: "Flattening every path a find walks makes later finds almost constant." }
---

Point every node a find passes straight at the root, making each operation almost constant time.

After a find reaches the root, a second pass climbs the same path again and points each site on it at the root, one write per site. The next find from any of them takes a single step, and the forest flattens as it is used.

This kernel compresses fully, in two passes; path halving, which points every other site at its grandparent in one pass, has the same bound. Combined with weighting, the amortised cost per operation is bounded by the inverse Ackermann function α(n), which does not exceed four for any input a physical computer can hold.
