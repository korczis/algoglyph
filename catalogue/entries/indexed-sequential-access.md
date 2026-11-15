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
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites:
  - binary-search
  objectives:
  - Find a key by binary-searching an index of first keys, then reading the one page that can hold it.
  - See why a static index sends inserts into a full page to overflow chains that lengthen searches.
algorithm:
  paradigm: search
bounds:
  model: index comparisons and page reads
  worst: 'at most ⌊lg P⌋ + 1 index comparisons over P primary pages; 1 page read, plus one per overflow page scanned'
claims:
  - id: primary-pages-at-load
    statement: >-
      160 keys loaded into pages of 8 at a load factor of 0.75 put round(8 · 0.75) = 6 keys on each
      page: ⌈160 / 6⌉ = 27 primary pages, whatever the keys.
    readout: Primary pages
    expect: { value: 27 }
    setup:
      params: { runs: 1 }
  - id: no-insertions-one-read-per-search
    statement: >-
      With no insertions nothing overflows, so every search reads its primary page alone: 500
      searches read exactly 500 pages.
    readout: Page reads in all
    expect: { value: 500 }
    setup:
      params: { inserts: 0, runs: 500 }
  - id: no-insertions-index-comparisons
    statement: >-
      The same 500 searches compare 2436 index entries in all: a binary search over the 27 first
      keys that runs to the end looks at 4 or 5 of them, about 4.9 on average, recomputed by an
      index search written in the test.
    readout: Index comparisons in all
    expect: { value: 2436 }
    setup:
      params: { inserts: 0, runs: 500 }
  - id: crowded-insertions-overflow-pages
    statement: >-
      With 40 % of 2000 operations inserting into the hot 5 % of the key range, the static index
      sends every key that misses a full primary page to its overflow chain: 7 overflow pages form,
      recomputed by an ISAM file written in the test.
    readout: Overflow pages
    expect: { value: 7 }
    setup:
      params: { runs: 2000 }
  - id: crowded-insertions-longest-chain
    statement: >-
      Those 7 overflow pages hang behind few primary pages, the longest chain 4 pages deep, so a
      search into the hot range reads up to 5 pages.
    readout: Longest overflow chain
    expect: { value: 4 }
    setup:
      params: { runs: 2000 }
  - id: spread-insertions-overflow-pages
    statement: >-
      With the same share of insertions spread over the whole key range, 44 overflow pages form, but
      no chain is longer than 3: crowding concentrates the slowdown, spreading distributes it,
      recomputed by an ISAM file written in the test.
    readout: Overflow pages
    expect: { value: 44 }
    setup:
      params: { runs: 2000, hot: false }
---

Keys in sorted pages with an index of their first keys, the ancestor of every database index.

Keys are kept in sorted pages of a fixed size, loaded part full, with an index holding the first key of each page. A search binary-searches the small index, reads the one page whose range can hold the key and scans it.

The index is built once at load time and never changes, so an insert that finds its primary page full goes to an overflow page chained behind it. Searches into that range then read the chain page by page. With inserts crowding into one key range a few chains grow long, and the chart shows the mean page reads per search climbing; reorganising the file, or an index that grows with the data as a B-tree's does, removes the problem.

Colour encodes key value. The index row sits above the pages, and the pages read by the latest operation are lit.
