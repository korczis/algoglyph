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
---

Cross out the multiples of each prime; what survives is prime.

The integers 2 to N are laid out in rows. For each number p that is still standing when the sieve reaches it, its multiples from p² on are crossed out; the smaller multiples of p have a smaller prime factor and are already gone. The sieve can stop once p² passes N.

A composite with several small prime factors is crossed once for each of them, so the crossings exceed the composites; the readouts count both, and the difference is the repeated work that the linear sieve avoids.

When the crossing ends, the survivors are the primes and are filled in. With rows of ten or twenty, the multiples of each prime fall into regular columns and slanted lines.
