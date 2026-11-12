---
id: knapsack-dp
title: Knapsack by dynamic programming
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
  - knapsack
complexity: "Θ(nW) time and space for n items and capacity W (pseudo-polynomial)"
related:
  - longest-common-subsequence
---

Fill a capacity table item by item; the best value for each capacity reuses smaller ones.

Each row adds one item, labelled weight/value; each column is a capacity. A cell is the better of leaving the item out (the cell above) or taking it (the cell above and the item's weight to the left, plus its value); the arrows show the two cells each one reads.

When the table is full, the bottom-right corner is the best value. The traceback climbs from it: wherever a cell differs from the one above, that item was taken and the walk steps left by its weight. The outlined path is that walk.

The work is one cell per item and capacity, so it grows with the capacity's numeric value, not with the length of its binary representation: pseudo-polynomial, which is no contradiction of the problem being NP-hard. The capacity here grows in proportion to the number of items, so on the chart's log-log axes the lines approach a slope of 2.
