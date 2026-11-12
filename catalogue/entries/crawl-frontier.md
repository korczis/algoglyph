---
id: crawl-frontier
title: Polite crawl frontier
taxonomy: systems/flow-control
status: live
engine: systems
sources:
  - id: practice-investigation
tags:
  - crawling
  - bfs
  - politeness
motivation: Link analysis in investigations and due diligence leans on it.
complexity: O(p + l) for p pages and l links, plus O(h) per pick for h hosts
related:
  - breadth-first-search
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
    - Keep one first-in, first-out queue per host with the earliest time the host may be contacted again, and let a free crawler take the host that has been ready longest.
    - Explain why queueing a page the first time any link to it is seen fetches each page once, while later links to it are counted and dropped.
    - Tell the breadth-first order within one host from the interleaving across hosts that the politeness delay imposes.
  prerequisites:
    - breadth-first-search
algorithm:
  paradigm: search
claims:
  - id: each-page-fetched-once
    statement: >-
      A page is queued the first time any link to it is seen, so each page is fetched once: the
      pages fetched equal the pages discovered, exactly.
    readout: Pages fetched
    expect: { against: Pages discovered, tolerance: 0 }
  - id: the-frontier-drains
    statement: >-
      The crawl ends when every crawler is idle and no page is left in any host's queue: the
      frontier is exactly empty.
    readout: Frontier size
    expect: { value: 0 }
  - id: no-host-hit-before-the-delay
    statement: >-
      A host may be contacted again only once the politeness delay has passed since its previous
      fetch started, so the closest two hits on one host are at least the delay apart: the
      closest minus the delay is at least 0 (whole milliseconds as displayed, so above −1).
    readout: Closest two hits on one host
    expect: { against: Politeness delay per host, above: -1 }
---

Breadth-first discovery of pages with a per-host rate, so no server is hammered.

The frontier keeps one first-in, first-out queue of pages per host, and for each host the earliest time it may be contacted again: the start of the previous fetch plus the politeness delay, and never while a fetch to it is still out. A free crawler takes the head of the queue of the host that has been ready longest, and sleeps until the next host is ready when none is.

A page is queued the first time any link to it is seen, so each page is fetched once; links to pages already seen are counted and dropped. Within one host the crawl is breadth-first, in discovery order; across hosts the politeness delay interleaves them. The harness checks that the pages fetched are exactly those reachable from the seed, once each, and that no host was hit sooner than the delay after its previous fetch.
