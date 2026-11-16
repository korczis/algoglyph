---
id: transport-investment
title: What to build, by return
taxonomy: graphs/flows
status: live
engine: custom
sources:
  - id: openttd-track
    purpose: implementation
tags:
  - multimodal routing
  - k shortest paths
  - knapsack
  - ROI
  - OpenTTD
complexity: per demand, Yen's k paths on a graph of places × modes; the portfolio a knapsack over the demands
related:
  - yen-k-shortest
  - knapsack-dp
  - track-planning
schema: algoglyph.entry/v2
claims:
  - id: every-route-is-considered
    statement: >-
      On the default world Yen's kernel enumerates 148 routes across the eight demands (direct by
      bus, rail or air, and through a hub with or without a change of mode), the count the test
      re-derives: exactly 148.
    readout: routes considered
    expect: { range: [148, 148] }
  - id: the-bus-wins-only-where-it-pays
    statement: >-
      Ranked by return on investment the bus is the best route for exactly one demand of the
      eight, the short one; rail wins the rest: 1 bus.
    readout: best by ROI
    expect: { range: [1, 1] }
  - id: seven-routes-pay-within-the-payback
    statement: >-
      With each fleet sized to the count that scores best (not to the whole volume), seven of the
      best routes repay their investment within the 24-month payback and enter the portfolio:
      exactly 7 chosen.
    readout: chosen
    expect: { range: [7, 7] }
---

For every demand, every way of carrying it — bus, train, plane, or a feeder into a trunk through a hub — priced as the game pays, and the one with the best return on investment kept, so the cheapest-looking mode is chosen only when it really pays.

The routes come from a multimodal graph: a node for each place and mode, a leg edge where a mode can run between two places (within its shortest and longest leg), a transfer edge where a hub lets cargo change mode. The collection's Yen's k-shortest-paths kernel enumerates them, fastest first, on the graph engine; with a direct leg and one hub that is every route there is.

Each route is priced as OpenTTD pays: the delivery earns on the Manhattan distance from the source to the final sink and the total transit time across all legs (the game's time factor: full while fast, falling by one and then two a period, decaying past its minimum), never the sum of what each leg would earn alone. Each leg carries its own costs: track or road, terminals at both ends, its vehicles and their running costs. The fleet is the count that scores best: carrying less than the whole demand when one more vehicle would cost more than the cargo it adds earns back within the payback. A road already built costs nothing to build again.

The return is twelve months of profit over the investment. The best route of each demand that repays within the payback enters a knapsack (the collection's knapsack-dp kernel) that picks the portfolio within the budget. The OpenTTD fork's planner calls it through the flow's command line (`npm run flow -- kernel transport-investment -`).
