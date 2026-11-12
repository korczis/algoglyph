---
id: b-tree
title: B-tree
taxonomy: searching/external
status: live
engine: tree
labs:
  - search-trees
sources:
  - id: sedgewick-aic
    ref: "Part 4: Searching"
tags:
  - b-tree
  - external search
  - pages
complexity: about log_t n pages per search, each searched in lg t comparisons
related:
  - two-three-four-tree
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites:
  - two-three-four-tree
  objectives:
  - Keep every page except the root between t − 1 and 2t − 1 keys, splitting full pages on the way down.
  - Count the pages a search reads, and see how raising t trades pages for comparisons inside each.
algorithm:
  paradigm: search
bounds:
  model: nodes touched (pages read)
  average: about log_t n pages per search, each searched by binary search
---

Nodes the size of a disk page, split when full, so a search touches log_M n pages.

The minimum degree t sets the page size: every page except the root holds between t-1 and 2t-1 keys, which the harness checks after every run. Within a page the key is found by binary search, and the count of nodes touched is the number of pages a disk-based tree would read.

A full page met on the way down is split around its median before the descent continues, so an insertion never backtracks; with t = 2 this is exactly the 2-3-4 tree. Raising t flattens the tree: fewer pages per search, more comparisons inside each.
