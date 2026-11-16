---
id: effective-ownership
title: Effective beneficial ownership
taxonomy: graphs/analysis
status: live
engine: graph
sources:
  - id: practice-investigation
tags:
  - ownership
  - paths
  - products
motivation: Link analysis in investigations and due diligence leans on it.
complexity: "O(E) per round"
interaction: "Tap a company to make it the target."
related:
  - ownership-cycles
  - pagerank
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
    - Multiply shares along every ownership path into the target and add the paths, to find who really owns how much.
    - Watch direct holdings count from the first round, holdings two steps away from the second, and so on.
    - See cross-holdings feed shares round the cycles with ever smaller products, so the change per round falls geometrically instead of stopping after the longest chain.
algorithm:
  paradigm: iterative-refinement
bounds:
  model: edge scans and rounds
  worst: "E minus the target's own holdings scanned per round; the longest chain into the target plus one rounds on an acyclic input"
  space: "O(V)"
claims:
  - id: largest-owner-is-the-linear-solve
    statement: >-
      The largest effective owner of the target is vertex 13, the largest share in one linear
      solve of e = W e + e_t (the target owning all of itself), by Gaussian elimination in
      test/effective-ownership-claims.test.ts, which sums the products along every path, the
      cycles through cross-holdings included.
    readout: Largest effective owner
    expect: { value: 13 }
  - id: largest-share-is-the-linear-solve
    statement: >-
      Its share is the solve's 38.6 % to the one decimal printed: no company is held above 95 % by
      its holders together, so every round shrinks the change and the run stops within 1e-9 of the
      solve.
    readout: Largest effective owner
    expect: { number: 2, value: 38.6 }
  - id: largest-owner-is-the-linear-solve-at-seed-7
    statement: >-
      At seed 7 the solve puts the largest effective owner at vertex 35.
    readout: Largest effective owner
    expect: { value: 35 }
    setup:
      seed: 7
  - id: largest-share-is-the-linear-solve-at-seed-7
    statement: >-
      And its share at 50.9 %, which the plate reads to the one decimal printed.
    readout: Largest effective owner
    expect: { number: 2, value: 50.9 }
    setup:
      seed: 7
  - id: largest-share-is-the-linear-solve-without-cross-holdings
    statement: >-
      With no cross-holdings the input is acyclic and the shares are finite sums of products: the
      largest is the solve's 24.0 %.
    readout: Largest effective owner
    expect: { number: 2, value: 24 }
    setup:
      params: { crossHoldings: 0 }
  - id: rounds-stop-after-the-longest-chain
    statement: >-
      With no cross-holdings round k adds the paths of exactly k holdings, so the rounds change
      something while some chain is that long and the first to change nothing is one after the
      longest chain into the target: 4 holdings long by a longest-path recursion over Kahn's order
      in the test, so 5 rounds at every seed, exactly.
    readout: Rounds
    expect: { value: 5 }
    setup:
      params: { crossHoldings: 0 }
      seeds: [4242, 7]
  - id: every-holding-scanned-each-round
    statement: >-
      Each round scans every holding except the target's own: 5 rounds of the acyclic input's 83
      holdings, the target holding none, so 415 edges examined, exactly.
    readout: Edges examined
    expect: { value: 415 }
    setup:
      params: { crossHoldings: 0 }
  - id: every-holding-scanned-each-round-at-seed-7
    statement: >-
      At seed 7 the acyclic input has 77 holdings and the same 5 rounds: 385 edges examined,
      exactly.
    readout: Edges examined
    expect: { value: 385 }
    setup:
      params: { crossHoldings: 0 }
      seed: 7
---

Multiply shares along every ownership path and add the paths: who really owns how much.

Edges run from owner to owned company. The boxed vertex is the target; vertex size and colour show the share each holder ends up with in it. Direct holdings count from the first round, holdings two steps away from the second, and so on.

Cross-holdings feed shares round the cycles with ever smaller products, so the change per round falls geometrically on the log chart instead of stopping after the longest chain.
