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
---

Multiply shares along every ownership path and add the paths: who really owns how much.

Edges run from owner to owned company. The boxed vertex is the target; vertex size and colour show the share each holder ends up with in it. Direct holdings count from the first round, holdings two steps away from the second, and so on.

Cross-holdings feed shares round the cycles with ever smaller products, so the change per round falls geometrically on the log chart instead of stopping after the longest chain.
