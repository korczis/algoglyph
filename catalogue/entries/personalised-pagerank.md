---
id: personalised-pagerank
title: Personalised PageRank
taxonomy: graphs/analysis
status: live
engine: graph
labs:
  - centrality
sources:
  - id: practice-investigation
tags:
  - pagerank
  - personalised
  - proximity
motivation: Link analysis in investigations and due diligence leans on it.
complexity: "O(E) per round; the error shrinks by a factor d per round"
interaction: "Tap a vertex to make it the subject."
related:
  - spreading-activation
---

The surfer teleports only to the subject, so the scores say who matters relative to them.

The circled vertex is the subject. Everything else is sized and coloured by how often a surfer who keeps restarting there would be found at it, which falls off with distance from the subject.

Compare with plain PageRank on the same input: the global hubs fade and the subject’s surroundings take over. Lower the damping and the scores concentrate further on the immediate neighbourhood.
