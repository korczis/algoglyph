---
id: ego-network
title: Ego network expansion
taxonomy: graphs/analysis
status: live
engine: graph
sources:
  - id: practice-investigation
tags:
  - ego network
  - k-hop
  - pivoting
motivation: Link analysis in investigations and due diligence leans on it.
complexity: "O(V + E) within the neighbourhood"
interaction: "Tap a vertex to make it the subject."
related:
  - breadth-first-search
  - personalised-pagerank
---

The neighbourhood of one subject, revealed one hop at a time.

Each ring of the search from the circled subject gets its own colour; when the k hops are done, everything farther is dimmed and the edges leaving the neighbourhood fade. The readouts list the ring sizes.

Raise k and compare inputs: on the small-world ring the rewired shortcuts make the rings grow fast, on the geometric input they grow roughly with the area covered.
