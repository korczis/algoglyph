---
id: dynamic-hash-table
title: Dynamic hash table
taxonomy: searching/hashing
status: live
engine: hash
labs:
  - hashing
sources:
  - id: sedgewick-aic
    ref: "Part 4: Searching"
tags:
  - hashing
  - resizing
  - amortised
complexity: O(1) amortised expected per operation
related:
  - linear-probing
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites:
  - linear-probing
  objectives:
  - Double a linear-probing table once it is more than half full, halve it below one eighth, and rehash every key.
  - See why geometric growth leaves each insert a constant amortised share of the rehashing.
  - See why the gap between the grow and shrink thresholds stops a table resizing back and forth.
algorithm:
  paradigm: search
bounds:
  model: probes
  average: 'O(1) amortised expected per operation; the load factor stays between 1/8 and 1/2 once the table has grown'
claims:
  - id: six-shared-bits-cluster-bound
    statement: >-
      With adversarial keys sharing 6 leading hash bits and no deletions, the 96 keys leave the
      table at 256 slots (it doubles past half full), and their homes, the hash's leading 8 bits,
      fall in 2^(8 − 6) = 4 adjacent slots; two clusters are parted by an empty slot, so at most 2
      clusters hold all 96 keys and the longest holds at least 48, a hard bound however the table
      grows.
    readout: Longest cluster
    expect: { above: 47 }
    setup:
      params: { stream: adversarial, deletes: 0, band: 6 }
---

Double the table once it is more than half full and rehash, keeping every operation constant on average.

A linear-probing table that starts small and doubles as soon as it is more than half full, and halves when it falls below one eighth full. A resize allocates a new table and inserts every key again, which the Rehashes readout and the hash and write counts record.

The load factor stays between 1/8 and 1/2 once the table has grown, so searches never reach the steep part of the linear-probing curve; the chart's measured points gather in that band, beside Knuth's linear-probing formulas as a reference.

The sizes grow geometrically, so the keys moved by all doublings together stay proportional to the keys inserted: each insert pays a constant amortised share. The gap between the grow and shrink thresholds keeps a table at either boundary from resizing back and forth.
