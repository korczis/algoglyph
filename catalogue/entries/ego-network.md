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
  - personalised-pagerank
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  objectives:
    - Reveal the neighbourhood of one subject one hop at a time, each ring of the search in its own colour, and read the ring sizes.
    - See everything farther than k hops dimmed when the k hops are done, and the edges leaving the neighbourhood fade.
    - Raise k and compare inputs; on the small-world ring the rewired shortcuts make the rings grow fast, on the geometric input they grow roughly with the area covered.
  prerequisites:
    - breadth-first-search
algorithm:
  paradigm: search
bounds:
  model: edge scans and rounds
  worst: "the degrees of the vertices within k − 1 hops, scanned once each; k rounds, fewer when the search runs out first"
  space: "O(V)"
claims:
  - id: first-ring-is-the-bfs-level
    statement: >-
      The first ring is the subject's neighbours: 5 vertices at hop distance 1, the count a
      breadth-first search over the edge lists in test/ego-network-claims.test.ts finds, exactly.
    readout: Ring sizes
    expect: { number: 2, value: 5 }
  - id: second-ring-is-the-bfs-level
    statement: >-
      The second ring is the vertices at hop distance 2: 5 of them, exactly.
    readout: Ring sizes
    expect: { number: 3, value: 5 }
  - id: first-ring-is-the-bfs-level-at-seed-7
    statement: >-
      At seed 7 the subject has 4 neighbours, exactly.
    readout: Ring sizes
    expect: { number: 2, value: 4 }
    setup:
      seed: 7
  - id: expanded-are-the-vertices-inside-k
    statement: >-
      Only the vertices fewer than k = 2 hops away are expanded, their edges scanned: the subject
      and its 5 neighbours, 6 vertices, exactly.
    readout: Expanded
    expect: { value: 6 }
  - id: expanded-are-the-vertices-inside-k-at-seed-7
    statement: >-
      At seed 7 the subject and its 4 neighbours, 5 vertices, exactly.
    readout: Expanded
    expect: { value: 5 }
    setup:
      seed: 7
  - id: newest-ring-is-the-last-ring
    statement: >-
      The ring at hop k is discovered and never expanded, so the newest ring is the last of the ring
      sizes: Newest ring equals Ring sizes' number 3 at k = 2, with no tolerance, at every seed.
    readout: Newest ring
    expect: { against: Ring sizes, against_number: 3, tolerance: 0 }
    setup:
      seeds: [4242, 7]
  - id: edges-examined-are-the-inner-degrees
    statement: >-
      Every expanded vertex scans its whole edge list once: the degrees of the 6 expanded vertices
      add up to 34, exactly.
    readout: Edges examined
    expect: { value: 34 }
  - id: one-hop-scans-the-subject-edges
    statement: >-
      At k = 1 only the subject is expanded, and on a simple graph each of its edges reaches a
      different neighbour: the edges examined equal Ring sizes' number 2, with no tolerance.
    readout: Edges examined
    expect: { against: Ring sizes, against_number: 2, tolerance: 0 }
    setup:
      params: { k: 1 }
      seeds: [4242, 7]
  - id: one-hop-expands-the-subject-alone
    statement: >-
      At k = 1 the subject is the only vertex expanded: 1, exactly, at every seed.
    readout: Expanded
    expect: { value: 1 }
    setup:
      params: { k: 1 }
      seeds: [4242, 7]
  - id: six-hops-expand-the-bfs-ball
    statement: >-
      At k = 6 the vertices fewer than 6 hops away are expanded: 64 of the 90, the search's count,
      exactly.
    readout: Expanded
    expect: { value: 64 }
    setup:
      params: { k: 6 }
  - id: six-hops-newest-ring
    statement: >-
      And the ring at hop 6 holds 10 vertices, exactly.
    readout: Newest ring
    expect: { value: 10 }
    setup:
      params: { k: 6 }
  - id: six-hops-take-six-rounds
    statement: >-
      The subject's eccentricity is at least 6 at both seeds, so the search never runs out and takes
      one round per ring: 6 rounds, exactly.
    readout: Rounds
    expect: { value: 6 }
    setup:
      params: { k: 6 }
      seeds: [4242, 7]
  - id: small-world-rings-grow-fast
    statement: >-
      On the small-world ring at k = 3 the rewired shortcuts already put 7 vertices in the third
      ring, exactly.
    readout: Newest ring
    expect: { value: 7 }
    setup:
      params: { shape: small-world, k: 3 }
---

The neighbourhood of one subject, revealed one hop at a time.

Each ring of the search from the circled subject gets its own colour; when the k hops are done, everything farther is dimmed and the edges leaving the neighbourhood fade. The readouts list the ring sizes.

Raise k and compare inputs: on the small-world ring the rewired shortcuts make the rings grow fast, on the geometric input they grow roughly with the area covered.
