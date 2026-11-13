---
id: sieve-of-eratosthenes
title: Sieve of Eratosthenes
taxonomy: numerics/number-theory
status: live
engine: grid
sources:
  - id: sedgewick-aic
    ref: "Part 2: Data Structures"
tags:
  - primes
  - sieve
complexity: "Θ(N log log N) crossings"
claims:
  - id: primes-found-pi-200
    statement: >-
      The survivors of the sieve up to 200 are exactly the π(200) = 46 primes, counted by trial
      division independently.
    readout: Primes found
    expect: { value: 46 }
    setup:
      params: { n: 200 }
  - id: primes-found-pi-600
    statement: >-
      Up to 600, the control's top, the survivors are exactly the π(600) = 109 primes.
    readout: Primes found
    expect: { value: 109 }
    setup:
      params: { n: 600 }
  - id: crossings-from-p-squared-200
    statement: >-
      Starting each prime p at p² and stopping once p² passes N, the sieve crosses the ⌊N/p⌋ − p + 1
      multiples p², p² + p, … ≤ N of each prime p ≤ √N: for N = 200 the sum over p = 2, 3, 5, 7,
      11, 13 is 99 + 64 + 36 + 22 + 8 + 3 = 232 crossings, exactly, more than the 153 composites
      because a composite is crossed once by each prime factor whose square it reaches.
    readout: Crossings
    expect: { value: 232 }
    setup:
      params: { n: 200 }
  - id: crossings-from-p-squared-600
    statement: >-
      For N = 600 the same sum Σ (⌊N/p⌋ − p + 1) over the primes up to 23 is exactly 806 crossings.
    readout: Crossings
    expect: { value: 806 }
    setup:
      params: { n: 600 }
---

Cross out the multiples of each prime; what survives is prime.

The integers 2 to N are laid out in rows. For each number p that is still standing when the sieve reaches it, its multiples from p² on are crossed out; the smaller multiples of p have a smaller prime factor and are already gone. The sieve can stop once p² passes N.

A composite with several small prime factors is crossed once for each of them, so the crossings exceed the composites; the readouts count both, and the difference is the repeated work that the linear sieve avoids.

When the crossing ends, the survivors are the primes and are filled in. With rows of ten or twenty, the multiples of each prime fall into regular columns and slanted lines.
