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
claims:
  - id: objective-equals-vertex-enumeration
    statement: >-
      Bland's rule stops at the optimum: the objective at the final vertex equals the best value
      over every vertex of the feasible polygon, which the plate finds independently by
      intersecting each pair of constraint lines, within 10⁻⁸, the display rounding of the two
      8-digit readouts. On seed 4242's 12 constraints both read 0.82694923, which an exact
      rational enumeration of the same data confirms.
    readout: Objective
    expect: { against: Best vertex by enumeration, tolerance: 1.0e-8 }
    setup:
      params: { constraints: 12, rule: bland }
  - id: objective-equals-vertex-enumeration-dantzig-24
    statement: >-
      With Dantzig's rule on 24 constraints, the control's top, the final objective again equals
      the enumerated best vertex within 10⁻⁸ (0.77832171 by an exact rational enumeration).
    readout: Objective
    expect: { against: Best vertex by enumeration, tolerance: 1.0e-8 }
    setup:
      params: { constraints: 24, rule: dantzig }
---

Walk from vertex to vertex of the feasible polytope, always uphill.

The tableau starts from the slack basis at the origin. Each pivot brings in a variable whose reduced cost would raise the objective, chooses the leaving row by the minimum ratio, and eliminates the entering column, which moves the solution along an edge to a neighbouring vertex.

Dantzig's rule takes the largest reduced cost; Bland's takes the first. On these problems Bland's needs as many pivots as Dantzig's more often than not, more of them most of the other times and fewer only rarely, but it provably cannot cycle; Dantzig's can, on a degenerate problem such as Beale's example, and the plate reports a return to a basis already visited as cycling rather than as an optimum. The best vertex found by enumerating every intersection of two constraints is shown alongside, as an independent check of the optimum.
