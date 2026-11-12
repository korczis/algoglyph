---
id: matrix-chain
title: Matrix-chain multiplication order
taxonomy: foundations/dynamic-programming
status: live
engine: grid
labs:
  - dynamic-programming
sources:
  - id: sedgewick-aic-1990
    ref: Advanced Topics
tags:
  - dynamic programming
  - parenthesisation
complexity: "Θ(n³) time, Θ(n²) space"
related:
  - optimal-bst
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
  - Find the cheapest parenthesisation of a matrix product from every shorter chain.
  - See why the table fills by chain length, one diagonal at a time.
algorithm:
  paradigm: dynamic-programming
bounds:
  model: cell reads
  worst: 'Θ(n³): n(n−1)(n+1)/3 + 1, two per split and one for the traceback'
  space: Θ(n²) cells
---

The cheapest order to multiply a chain of matrices, from the costs of every shorter chain.

Cell (i, j) above the diagonal is the fewest scalar multiplications that compute the product of matrices i to j. Filling goes by chain length, one diagonal at a time, because every split of a chain refers to two strictly shorter chains: one in the same row to the left, one in the same column below.

Each cell tries every split point, so the arrows fan in from the whole row segment and the whole column segment. Over the table that is n(n-1)(n+1)/6 splits, so on the log-log chart the reads climb at a slope near 3 while the cells stay near 2.

The traceback follows the remembered best split of each chain and prints the full parenthesisation; the outlined cells are the subchains it visits. Order matters: the same product can cost many times more multiplied left to right.
