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
---

How much independent evidence ultimately stands under a conclusion in a reasoning graph.

Evidence sits on the bottom row, claims above it, the conclusion boxed on top. A reverse search from the conclusion rings and fills everything that stands under it; then each independent line found is drawn thick and its evidence marked.

Shared evidence is what keeps the count small: when many items support the conclusion only through one intermediate claim, that claim alone cuts them off, so they make one line however many they are.
