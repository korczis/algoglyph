---
id: weighted-quick-union
title: Weighted quick-union
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
  - balanced
complexity: at most lg n links per find
relations:
  - { type: improves_on, target: quick-union, reason: "Linking the smaller tree under the larger bounds every tree's height by lg n." }
---

Link the smaller tree under the larger, so no tree grows taller than lg n.

Each root also keeps the size of its tree, in the second half of the array. Hanging the smaller tree under the larger root means a site goes one level deeper only when its tree at least doubles, which can happen at most lg n times.

Even the chain input that turns plain quick-union into a path leaves a flat forest here; the test harness checks the lg n bound on the depth of every site, on every input it runs.
