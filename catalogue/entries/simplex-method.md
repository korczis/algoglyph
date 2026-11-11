---
id: simplex-method
title: Simplex method
taxonomy: numerics/optimisation
status: live
engine: numeric
sources:
  - id: sedgewick-aic-1990
    ref: Advanced Topics
tags:
  - linear programming
  - simplex
complexity: 'exponential in the worst case, usually a small multiple of the number of constraints'
related:
  - gaussian-elimination
  - pareto-front
---

Walk from vertex to vertex of the feasible polytope, always uphill.

The tableau starts from the slack basis at the origin. Each pivot brings in a variable whose reduced cost would raise the objective, chooses the leaving row by the minimum ratio, and eliminates the entering column, which moves the solution along an edge to a neighbouring vertex.

Dantzig's rule takes the largest reduced cost; Bland's takes the first, which is slower here but provably cannot cycle. The best vertex found by enumerating every intersection of two constraints is shown alongside, as an independent check of the optimum.
