---
id: fibonacci-memo
title: Fibonacci, recursion versus memoisation
taxonomy: foundations/dynamic-programming
status: live
engine: grid
sources:
  - id: sedgewick-aic
    ref: "Part 2: Data Structures"
tags:
  - dynamic programming
  - memoisation
  - recursion
complexity: "exponential calls naive (about φ^n), linear calls memoised"
related:
  - knapsack-dp
---

The naive recursion's exponential call tree next to the linear table that remembers it.

The top row is the naive recursion: each call on k stores its value again, so the bar under a cell grows with how often that subproblem is solved. Computing F(n) this way makes 2F(n+1) - 1 calls, and the call count grows by the golden ratio with each step of n.

The bottom row is the same recursion with a memo table: a call first looks its argument up, and only a miss computes it. Every argument is computed once and each computation above the base cases makes two calls, so F(n) costs 2n - 1 calls.

The chart measures both call counts as n grows, on a logarithmic axis: the naive line is straight (exponential), the memoised one flattens (linear). The readouts count the recomputations the memo avoids and the hits that replace them.
