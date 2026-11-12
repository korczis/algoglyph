---
id: ownership-cycles
title: Circular ownership by DFS colouring
taxonomy: graphs/connectivity
status: live
engine: graph
sources:
  - id: practice-investigation
tags:
  - cycles
  - ownership
  - dfs colouring
motivation: Link analysis in investigations and due diligence leans on it.
complexity: "O(V + E)"
related:
  - tarjan-scc
  - topological-sort
---

White, grey and black vertices: a grey vertex met again closes a cycle of companies owning each other.

Ringed vertices are grey (on the DFS stack), filled ones black (finished). When an edge reaches a grey vertex, the cycle it closes is read off the stack and drawn in the foreground colour, and at the end every vertex on a found cycle is marked. The ownership input plants cross-holdings, a company holding a stake in one of its own indirect owners, so cycles appear; the layered DAG input has none and the verdict reads acyclic.

DFS reports one cycle per back edge, not every cycle of the graph: cycles that overlap can hide behind one report. The strong components group every company that lies on any cycle with all the others it is entangled with.
