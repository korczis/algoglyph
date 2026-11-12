---
id: sugiyama-layout
title: Layered DAG layout (Sugiyama)
taxonomy: graphs/layout
status: live
engine: graph
sources:
  - id: practice-systems
tags:
  - layered layout
  - crossing minimisation
motivation: Coordinating many workers and machines without a shared clock depends on it.
complexity: "crossing minimisation is NP-hard; each barycentre sweep sorts every layer, O(N log N) for N vertices and dummy nodes"
related:
  - topological-sort
---

Assign layers, order each layer to reduce crossings, then place: how plans are drawn.

Colours are layers. The first steps break cycles (reversed edges are drawn in the frontier colour; only the ownership input has any) and assign layers by longest path; then every sweep re-places the vertices.

The readouts compare the crossings before the sweeps with the best order found. Edges that skip layers are drawn straight; the count is of the layered drawing, where they bend through dummy positions.
