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
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
  - Fill a capacity table item by item, each cell the better of leaving or taking the item.
  - Recover the chosen items by tracing back from the corner.
  - Understand why Θ(nW) is pseudo-polynomial and no contradiction of NP-hardness.
algorithm:
  paradigm: dynamic-programming
bounds:
  model: table cells computed
  worst: Θ(nW) for n items and capacity W
  space: Θ(nW)
claims:
  - id: half-capacity-table-cells
    statement: >-
      At 0.5 capacity per item the 7 items get capacity W = max(4, round(3.5)) = 4, so the table
      computes (n + 1)(W + 1) = 8 · 5 = 40 cells, exactly: one cell per item row and capacity.
    readout: Cells computed
    expect: { value: 40 }
    setup:
      params: { capacityPerItem: 0.5 }
  - id: unit-capacity-table-cells
    statement: >-
      At 1 capacity per item the 7 items get W = 7, so the table computes (n + 1)(W + 1) = 8 · 8 =
      64 cells, exactly.
    readout: Cells computed
    expect: { value: 64 }
    setup:
      params: { capacityPerItem: 1 }
  - id: half-capacity-best-is-brute-force
    statement: >-
      At 0.5 capacity per item (W = 4) the corner holds 20, the best of all 2^7 = 128 subsets of
      the items 5/9 3/7 8/12 5/15 6/16 3/13 3/20 within weight 4 (item 7 alone), exactly: the
      value comes from enumerating every subset, not from the table.
    readout: Result
    expect: { value: 20 }
    setup:
      params: { capacityPerItem: 0.5 }
  - id: unit-capacity-best-is-brute-force
    statement: >-
      At 1 capacity per item (W = 7) the corner holds 33, the best of all 128 subsets within
      weight 7 (items 6 and 7), exactly, by enumerating every subset.
    readout: Result
    expect: { value: 33 }
    setup:
      params: { capacityPerItem: 1 }
  - id: one-and-a-half-capacity-best-is-brute-force
    statement: >-
      At 1.5 capacity per item, W = round(10.5) = 11 and the corner holds 48, the best of all 128
      subsets within weight 11 (items 4, 6 and 7), exactly, by enumerating every subset.
    readout: Result
    expect: { value: 48 }
    setup:
      params: { capacityPerItem: 1.5 }
---

Fill a capacity table item by item; the best value for each capacity reuses smaller ones.

Each row adds one item, labelled weight/value; each column is a capacity. A cell is the better of leaving the item out (the cell above) or taking it (the cell above and the item's weight to the left, plus its value); the arrows show the two cells each one reads.

When the table is full, the bottom-right corner is the best value. The traceback climbs from it: wherever a cell differs from the one above, that item was taken and the walk steps left by its weight. The outlined path is that walk.

The work is one cell per item and capacity, so it grows with the capacity's numeric value, not with the length of its binary representation: pseudo-polynomial, which is no contradiction of the problem being NP-hard. The capacity here grows in proportion to the number of items, so on the chart's log-log axes the lines approach a slope of 2.
