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
---

Breadth-first discovery of pages with a per-host rate, so no server is hammered.

The frontier keeps one first-in, first-out queue of pages per host, and for each host the earliest time it may be contacted again: the start of the previous fetch plus the politeness delay, and never while a fetch to it is still out. A free crawler takes the head of the queue of the host that has been ready longest, and sleeps until the next host is ready when none is.

A page is queued the first time any link to it is seen, so each page is fetched once; links to pages already seen are counted and dropped. Within one host the crawl is breadth-first, in discovery order; across hosts the politeness delay interleaves them. The harness checks that the pages fetched are exactly those reachable from the seed, once each, and that no host was hit sooner than the delay after its previous fetch.
