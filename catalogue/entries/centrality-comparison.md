---
id: centrality-comparison
title: Degree, closeness and eigenvector centrality
taxonomy: graphs/analysis
status: live
engine: graph
labs:
  - centrality
sources:
  - id: practice-investigation
tags:
  - centrality
  - ranking
motivation: Link analysis in investigations and due diligence leans on it.
complexity: "degree O(E); closeness O(VE); eigenvector O(E) per power-iteration round"
related:
  - pagerank
---

Three answers to who is central, side by side on one graph.

The three measures are computed in turn and each is left on the vertices (size and colour) until the next replaces it: degree first, then closeness one breadth-first search at a time, then the power iteration (at most 300 rounds; the readouts say whether it converged), whose change per round falls on the log chart.

At the end the readouts name the most central vertex by each measure and the rank agreement between them (Spearman’s ρ). Degree is local, closeness rewards being near everyone, and eigenvector centrality rewards having central neighbours.
