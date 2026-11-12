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
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites: [mergesort-top-down, shear-sort]
  objectives:
  - 'Read the Rounds readout: 4 on every input and at every size, the four steps that sort every column at once; the other four steps only move keys by fixed permutations.'
  - 'Watch the first phase at 512 keys: a matrix of 84 rows and 7 columns, with the column count dividing the row count and r ≥ 2(s − 1)²; the shift opens an eighth column, and the Lanes readout counts 8.'
  - 'Explain why any column sort, on any machine, becomes part of a sort with a fixed number of passes.'
  misconceptions:
  - 'Columnsort needs a number of phases that grows with n, as shearsort does; it takes four rounds of column sorts at every size, at 8 keys as at 512.'
algorithm:
  properties:
    stable: false
    in_place: false
bounds:
  model: 'comparisons (inside the column merge sorts), array writes (the matrix written back after every step, one per key that moved) and rounds (the column-sorting steps, every column at once)'
  average: 'from 2 keys on, 4 rounds and 9 phases on every input, on an r × s matrix with s dividing r, r even and r ≥ 2(s − 1)²; the column merge sorts compare keys, so the comparisons depend on the input'
claims:
  - id: four-column-sorts
    statement: >-
      On Random permutation at 512 keys columnsort takes 4 rounds, the four steps that sort every column of its 84 × 7 matrix at once; transposing and shifting are fixed permutations and need no round of comparisons.
    readout: Rounds
    expect: { value: 4 }
    setup:
      params: { shape: random, n: 512, speed: 2000 }
---

Leighton's columnsort: put the keys into an r × s matrix in column-major order and sort it in eight steps, of which four sort every column independently and four move the keys by fixed permutations (a transpose, its inverse, a shift by half a column and its inverse).

The permutations do not depend on the keys, so any method of sorting a column, on s processors, in a fixed circuit or on another machine, becomes part of a larger sort with a fixed number of passes. It works when r is divisible by s and r ≥ 2(s − 1)², a matrix much taller than wide; Leighton used it as a tool for building sorting networks of bounded degree.

The plate fills the matrix column by column, sorts the columns by merging, writes the matrix back to the array after every step and counts the total work: four rounds of column sorts, on the order of n log n comparisons for every input, plus linear moves for the permutations. In one thread the moves go through an auxiliary array, so it needs linear extra space. Start with Random permutation at n = 64 and watch which steps sort and which only shuffle.

Compared with shearsort it needs only a fixed number of steps instead of a logarithmic number of phases, at the price of the condition on the matrix shape, which limits the number of columns to roughly the cube root of n. It is not stable: the permutations mix keys from different columns without regard to their original order.
