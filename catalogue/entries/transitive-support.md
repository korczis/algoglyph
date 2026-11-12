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
      rests on round(0.7 × 8) = 6 draws from the 8 claims below it, so at most 6 lines reach it
      however many evidence items stand under it.
    readout: Independent lines of support
    expect: { range: [1, 6] }
---

How much independent evidence ultimately stands under a conclusion in a reasoning graph.

Evidence sits on the bottom row, claims above it, the conclusion boxed on top. A reverse search from the conclusion rings and fills everything that stands under it; then each independent line found is drawn thick and its evidence marked.

Shared evidence is what keeps the count small: when many items support the conclusion only through one intermediate claim, that claim alone cuts them off, so they make one line however many they are.
