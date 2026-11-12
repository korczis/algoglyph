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
---

Walk from vertex to vertex of the feasible polytope, always uphill.

The tableau starts from the slack basis at the origin. Each pivot brings in a variable whose reduced cost would raise the objective, chooses the leaving row by the minimum ratio, and eliminates the entering column, which moves the solution along an edge to a neighbouring vertex.

Dantzig's rule takes the largest reduced cost; Bland's takes the first. On these problems Bland's needs as many pivots as Dantzig's more often than not, more of them most of the other times and fewer only rarely, but it provably cannot cycle; Dantzig's can, on a degenerate problem such as Beale's example, and the plate reports a return to a basis already visited as cycling rather than as an optimum. The best vertex found by enumerating every intersection of two constraints is shown alongside, as an independent check of the optimum.
