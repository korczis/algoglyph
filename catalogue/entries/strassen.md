---
id: strassen
title: Strassen's matrix multiplication
taxonomy: numerics/arithmetic
status: live
engine: numeric
sources:
  - id: sedgewick-aic-1990
    ref: Mathematical Algorithms
tags:
  - matrices
  - divide and conquer
complexity: '7^lg n = n^2.807 multiplications, with more additions than the triple loop'
related:
  - gaussian-elimination
---

Seven half-size products instead of eight: n^2.81.

The seven products M1 … M7 of quadrant sums are computed one per step, each recursively down to single entries, and the panel C shows the quadrants assembled from the products known so far; the outlines mark the operand quadrants of the product in progress.

The meter counts 7^k scalar multiplications for 2^k × 2^k matrices, against n³ for the triple loop, and the chart shows the additions too: they grow at the same exponent with a larger constant, which is why practical implementations stop the recursion at a block size. The final C is compared entry by entry with the triple loop.
