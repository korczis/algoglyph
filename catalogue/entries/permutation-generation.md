---
id: permutation-generation
title: Permutation generation
taxonomy: foundations/exhaustive
status: live
engine: custom
sources:
  - id: sedgewick-aic-1990
    ref: Advanced Topics
tags:
  - exhaustive search
  - permutations
complexity: 'n! permutations, one exchange each; amortised O(1) work per step for Heap''s method, O(n) for Johnson–Trotter as written'
related:
  - n-queens
---

Every permutation of n items, each from the last by one exchange.

Every permutation of n items appears exactly once, each reached from the one before by a single exchange. Each column of the picture is one permutation read top to bottom, coloured by item, and a thin thread joins the two positions exchanged to reach it.

Heap's method exchanges position k with the first position when k is even, or with a position chosen by a per-level counter when k is odd. The Johnson–Trotter method gives every item a direction, moves the largest item that can move one step that way, and reverses the direction of every larger item; all its exchanges are between neighbours, as the readouts show.

There are n! permutations, and n! grows faster than any fixed power cⁿ: exhaustive search over orderings runs out of time long before it runs out of ideas.
