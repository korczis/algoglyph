---
id: columnsort
title: Columnsort
taxonomy: sorting/networks
status: live
engine: array
labs:
  - sorting
sources:
  - id: leighton-1985
    ref: the original eight steps and their conditions
  - id: knuth-taocp-3
    ref: "5.3.4 Networks for sorting"
tags:
  - sorting
  - sorting network
  - oblivious
  - parallel
  - matrix
complexity: n log n in every case; extra space n
related:
  - aks-sorting-network
  - bitonic-sort
  - shear-sort
---

Leighton's columnsort: put the keys into an r × s matrix in column-major order and sort it in eight steps, of which four sort every column independently and four move the keys by fixed permutations (a transpose, its inverse, a shift by half a column and its inverse).

The permutations do not depend on the keys, so any method of sorting a column, on s processors, in a fixed circuit or on another machine, becomes part of a larger sort with a fixed number of passes. It works when r is divisible by s and r ≥ 2(s − 1)², a matrix much taller than wide; Leighton used it as a tool for building sorting networks of bounded degree.

The plate fills the matrix column by column, sorts the columns by merging, writes the matrix back to the array after every step and counts the total work: four rounds of column sorts, on the order of n log n comparisons for every input, plus linear moves for the permutations. In one thread the moves go through an auxiliary array, so it needs linear extra space. Start with Random permutation at n = 64 and watch which steps sort and which only shuffle.

Compared with shearsort it needs only a fixed number of steps instead of a logarithmic number of phases, at the price of the condition on the matrix shape, which limits the number of columns to roughly the cube root of n. It is not stable: the permutations mix keys from different columns without regard to their original order.
