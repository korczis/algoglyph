---
id: indexed-sequential-access
title: Indexed sequential access
taxonomy: searching/external
status: live
engine: custom
sources:
  - id: sedgewick-aic
    ref: "Part 4: Searching"
tags:
  - external search
  - index
  - pages
complexity: 'about lg(pages) index comparisons and one page read per search until overflow chains form'
related:
  - b-tree
  - binary-search
---

Keys in sorted pages with an index of their first keys, the ancestor of every database index.

Keys are kept in sorted pages of a fixed size, loaded part full, with an index holding the first key of each page. A search binary-searches the small index, reads the one page whose range can hold the key and scans it.

The index is built once at load time and never changes, so an insert that finds its primary page full goes to an overflow page chained behind it. Searches into that range then read the chain page by page. With inserts crowding into one key range a few chains grow long, and the chart shows the mean page reads per search climbing; reorganising the file, or an index that grows with the data as a B-tree's does, removes the problem.

Colour encodes key value. The index row sits above the pages, and the pages read by the latest operation are lit.
