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
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  objectives:
    - Colour the vertices white, grey and black as the depth-first search meets, enters and finishes them, an edge that reaches a grey vertex closing a cycle of companies owning each other.
    - Read each cycle off the stack when its closing edge is met, and see every vertex on a found cycle marked at the end.
    - Compare the ownership input, whose cross-holdings plant cycles, with the layered DAG input, which has none and reads acyclic.
  prerequisites:
    - depth-first-search
  misconceptions:
    - DFS colouring does not list every cycle of the graph; it reports one cycle per back edge, so cycles that overlap can hide behind one report, and only the strong components group every company that lies on any cycle.
algorithm:
  paradigm: search
bounds:
  model: "edges examined: each vertex scans its out-edges once"
  best: "m on every input"
  worst: "m on every input"
claims:
  - id: every-out-edge-once
    statement: >-
      Each vertex is entered once and scans each of its out-edges once, so the edges examined equal
      the Graph readout's edges on the ownership input at both seeds listed, with no tolerance.
    readout: Edges examined
    expect: { against: Graph, against_number: 2, tolerance: 0 }
    setup:
      seeds: [4242, 7]
  - id: every-out-edge-once-on-the-digraph
    statement: >-
      On the digraph, with its two-way pairs, every out-edge is still examined once: the edges
      examined equal the Graph readout's edges at both seeds listed, with no tolerance.
    readout: Edges examined
    expect: { against: Graph, against_number: 2, tolerance: 0 }
    setup:
      params: { shape: digraph }
      seeds: [4242, 7]
  - id: every-vertex-finished
    statement: >-
      The search restarts from every vertex still white, so every vertex ends black: Black
      (finished) reads n of n at both seeds listed, its first number minus its second 0, with no
      tolerance.
    readout: Black (finished)
    expect: { against: Black (finished), against_number: 2, tolerance: 0 }
    setup:
      seeds: [4242, 7]
  - id: the-dag-is-acyclic
    statement: >-
      Kahn's peeling in test/ownership-cycles-claims.test.ts removes every vertex of the layered
      DAG input at both seeds listed, so it has no cycle and no edge reaches a grey vertex: 0
      cycles closed, exactly.
    readout: Cycles closed
    expect: { value: 0 }
    setup:
      params: { shape: dag }
      seeds: [4242, 7]
  - id: no-cross-holdings-no-cycle
    statement: >-
      At 0 cross-holdings no company holds a stake in one of its owners, and Kahn's peeling removes
      every company at both seeds listed: 0 cycles closed, exactly.
    readout: Cycles closed
    expect: { value: 0 }
    setup:
      params: { crossHoldings: 0 }
      seeds: [4242, 7]
  - id: cycles-closed-on-ownership
    statement: >-
      Each strong component with two or more companies holds at least one back edge, the edge into
      its first-entered company from inside it, and every back edge lies inside one, beside the
      component's |C| − 1 tree edges: the cycles closed lie between the count of such components and
      Σ (m_C − |C| + 1). The classes of mutual reachability in the test give 5 and 5 on the default
      ownership input, so 5, exactly.
    readout: Cycles closed
    expect: { value: 5 }
  - id: cycles-closed-at-twelve-cross-holdings
    statement: >-
      At 12 cross-holdings per 12 companies the same bounds are 3 and 68, by the test's classes of
      mutual reachability, hard bounds.
    readout: Cycles closed
    expect: { range: [3, 68] }
    setup:
      params: { crossHoldings: 12 }
  - id: cycles-closed-on-the-digraph
    statement: >-
      On the digraph the bounds are 5 and 75, by the test's classes of mutual reachability, hard
      bounds.
    readout: Cycles closed
    expect: { range: [5, 75] }
    setup:
      params: { shape: digraph }
  - id: companies-on-a-found-cycle-on-ownership
    statement: >-
      Every company on a found cycle lies in a strong component of two or more, and each such
      component's back edge closes a cycle of at least two of its companies: the companies marked
      lie between twice the count of those components and their size, 10 and 12 on the default
      ownership input by the test's classes of mutual reachability, hard bounds.
    readout: On a cycle found
    expect: { range: [10, 12] }
  - id: companies-on-a-found-cycle-on-the-digraph
    statement: >-
      On the digraph the same bounds are 10 and 59 by the test's classes of mutual reachability,
      hard bounds.
    readout: On a cycle found
    expect: { range: [10, 59] }
    setup:
      params: { shape: digraph }
---

White, grey and black vertices: a grey vertex met again closes a cycle of companies owning each other.

Ringed vertices are grey (on the DFS stack), filled ones black (finished). When an edge reaches a grey vertex, the cycle it closes is read off the stack and drawn in the foreground colour, and at the end every vertex on a found cycle is marked. The ownership input plants cross-holdings, a company holding a stake in one of its own indirect owners, so cycles appear; the layered DAG input has none and the verdict reads acyclic, as does the ownership input with its cross-holdings control at 0.

DFS reports one cycle per back edge, not every cycle of the graph: cycles that overlap can hide behind one report. The strong components group every company that lies on any cycle with all the others it is entangled with.
