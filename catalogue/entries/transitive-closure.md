---
id: transitive-closure
title: Transitive closure (Warshall)
taxonomy: graphs/digraphs
status: live
engine: graph
sources:
  - id: sedgewick-aic
    ref: "Part 5: Graph Algorithms"
tags:
  - transitive closure
  - reachability
  - matrix
complexity: "O(V³)"
related:
  - floyd-warshall
  - kosaraju-scc
---

Who can reach whom, filled into a matrix one intermediate vertex at a time.

The matrix on the right has a row and a column per vertex; a filled cell (i, j) says that i reaches j. It starts from the diagonal and the edges. In round k the ringed vertex k is the stepping stone: every row that reaches k gains k’s row, and the outlined cell is the one just written.

Vertices of one strong component end with identical rows, since each reaches whatever the others reach. The chart counts the filled cells round by round.
