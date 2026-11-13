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
claims:
  - id: seven-to-the-k-multiplications-16
    statement: >-
      Seven half-size products per level, recursing down to single entries with no cutoff, cost
      7^k scalar multiplications for 2^k × 2^k matrices: exactly 7⁴ = 2,401 at 16 × 16, against
      16³ = 4,096 for the triple loop.
    readout: Multiplications
    expect: { value: 2401 }
    setup:
      params: { n: '16' }
  - id: seven-to-the-k-multiplications-32
    statement: >-
      At 32 × 32 the count is exactly 7⁵ = 16,807 multiplications, against 32³ = 32,768 for the
      triple loop.
    readout: Multiplications
    expect: { value: 16807 }
    setup:
      params: { n: '32' }
  - id: additions-six-times-seven-k-minus-four-k-16
    statement: >-
      Each level forms ten operand sums and eight combining sums of half-size quadrants, 18 (n/2)²
      additions and subtractions, around its seven products. The recurrence A(n) = 7A(n/2) +
      18(n/2)² with A(1) = 0 solves to 6(7^k − 4^k), exactly 12,870 at 16 × 16: more than the
      triple loop's n²(n − 1) = 3,840, which is why practical code stops recursing at a block.
    readout: Additions
    expect: { value: 12870 }
    setup:
      params: { n: '16' }
  - id: additions-six-times-seven-k-minus-four-k-32
    statement: >-
      The same closed form 6(7^k − 4^k) gives exactly 94,698 additions at 32 × 32, k = 5.
    readout: Additions
    expect: { value: 94698 }
    setup:
      params: { n: '32' }
  - id: product-equals-the-triple-loop
    statement: >-
      Strassen's product equals the triple loop's entry by entry: with integer entries in [−9, 9]
      every intermediate is an integer far below 2^53, so the arithmetic is exact and the largest
      difference is 0, not a rounding error.
    readout: max |C − triple loop|
    expect: { value: 0 }
    setup:
      params: { n: '16' }
---

Seven half-size products instead of eight: n^2.81.

The seven products M1 … M7 of quadrant sums are computed one per step, each recursively down to single entries, and the panel C shows the quadrants assembled from the products known so far; the outlines mark the operand quadrants of the product in progress.

The meter counts 7^k scalar multiplications for 2^k × 2^k matrices, against n³ for the triple loop, and the chart shows the additions too: they grow at the same exponent with a larger constant, which is why practical implementations stop the recursion at a block size. The final C is compared entry by entry with the triple loop.
