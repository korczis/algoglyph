---
id: transitive-support
title: Transitive support of a conclusion
taxonomy: inference/belief
status: live
engine: graph
sources:
  - id: practice-investigation
tags:
  - reasoning
  - evidence graphs
  - support
motivation: Link analysis in investigations and due diligence leans on it.
complexity: "O(V + E) for the search; O(L E) for L independent lines"
interaction: "Tap a claim to make it the conclusion."
related:
  - ford-fulkerson
  - edmonds-karp
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
  - Find everything that stands under a conclusion with one reverse search from it.
  - Count independent lines of support rather than the evidence items under the conclusion.
  - Explain how one intermediate claim shared by many items cuts them all off into a single line.
algorithm:
  paradigm: search
claims:
  - id: lines-capped-by-the-conclusions-supports
    statement: >-
      Shared support keeps the count of independent lines small: with 40 vertices the conclusion
      rests, at the default 0.7 draws per claim below, on round(0.7 × 8) = 6 draws from the 8
      claims below it, so at most 6 lines reach it however many evidence items stand under it.
    readout: Independent lines of support
    expect: { range: [1, 6] }
  - id: one-supporting-claim-one-line
    statement: >-
      At 0.05 draws per claim below, the conclusion of the 40-vertex graph draws max(1,
      round(0.05 × 8)) = 1 claim, and every line of support enters it by its own edge, so all the
      evidence under it makes exactly one line: one shared claim cuts them all off together.
    readout: Independent lines of support
    expect: { value: 1, tolerance: 0 }
    setup:
      params: { fanIn: 0.05 }
  - id: lines-capped-at-half-a-draw-per-claim
    statement: >-
      The 40 vertices are 18 evidence items (45%), 13 and 8 claims (60% of the 21 claims, then the
      rest) and the conclusion. At 0.5 draws per claim below, the conclusion draws round(0.5 × 8)
      = 4 times from the 8 claims, with replacement, so it has at most 4 supports and at most 4
      lines reach it, a hard bound; there is always at least one.
    readout: Independent lines of support
    expect: { range: [1, 4] }
    setup:
      params: { fanIn: 0.5 }
  - id: lines-capped-at-a-draw-per-claim
    statement: >-
      At one draw per claim below, the conclusion draws round(1 × 8) = 8 times from the 8 claims,
      with replacement, so at most 8 lines reach it, a hard bound; there is always at least one.
    readout: Independent lines of support
    expect: { range: [1, 8] }
    setup:
      params: { fanIn: 1 }
---

How much independent evidence ultimately stands under a conclusion in a reasoning graph.

Evidence sits on the bottom row, claims above it, the conclusion boxed on top. A reverse search from the conclusion rings and fills everything that stands under it; then each independent line found is drawn thick and its evidence marked.

Shared evidence is what keeps the count small: when many items support the conclusion only through one intermediate claim, that claim alone cuts them off, so they make one line however many they are.
