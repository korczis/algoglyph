---
id: credible-path
title: Most credible path
taxonomy: graphs/shortest-paths
status: live
engine: graph
sources:
  - id: practice-investigation
tags:
  - dijkstra
  - confidence
  - evidence
motivation: Link analysis in investigations and due diligence leans on it.
complexity: "O(E log V)"
interaction: "Tap a vertex to start from it."
related:
  - dijkstra
  - yen-k-shortest
---

Dijkstra over edge costs of one minus confidence: the best-supported link between two entities.

Each link carries a confidence between 0.30 and 0.99. Dijkstra runs from the circled source to the boxed target, stops once the target is settled, and draws the chosen path in the foreground colour.

The default cost 1 − c adds up doubts, which favours paths of few strong links. Switch the edge cost to −ln c to maximise the product of the confidences, the probability that every link holds if they fail independently. The readouts give that product either way, so the two rules can be compared on one graph.
