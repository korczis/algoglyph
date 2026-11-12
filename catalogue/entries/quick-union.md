---
id: quick-union
title: Quick-union
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
  - forest
complexity: proportional to the tree height per find, n in the worst case
related:
  - quick-find
  - weighted-quick-union
---

Each object points to a parent; a union links one root under the other and a find climbs to the root.

A find climbs parent links to the root, one array read per link; a union is two finds and one write. Nothing keeps the trees short: on the chain input each union hangs a root under its neighbour, the forest becomes a single path, and a find from its far end climbs every site.

The height is measured on the replayed forest after every union, and the chart sets it against lg(n+1) so the difference from the weighted version is visible on the same input.
