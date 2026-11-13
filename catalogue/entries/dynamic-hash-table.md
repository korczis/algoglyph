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
  - Double a linear-probing table once it is more than half full, halve it below one eighth (by default), and rehash every key.
  - See why geometric growth leaves each insert a constant amortised share of the rehashing.
  - See why the gap between the grow and shrink thresholds stops a table resizing back and forth.
algorithm:
  paradigm: search
bounds:
  model: probes
  average: 'O(1) amortised expected per operation; the load factor stays between the shrink and grow thresholds (1/8 and 1/2 by default) once the table has grown'
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
  - id: three-quarters-rehash-count
    statement: >-
      Growing past 3/4 with no deletions, the 96 keys of the default run cost exactly 5 rehashes:
      the table starts at 4 slots and doubles on the insert that takes it past 3/4 full, so it
      ends at the least 4 · 2^k with 96 ≤ 3/4 · 4 · 2^k, k = ⌈lg(96 / 3)⌉ = 5.
    readout: Rehashes
    expect: { value: 5 }
    setup:
      params: { deletes: 0, grow: 3/4 }
  - id: three-quarters-full-not-past
    statement: >-
      At the same setting the table ends exactly 3/4 full, 96 keys in 128 slots: the 96th insert
      brings it to 3/4 and only an insert past it doubles, so the load factor reaches the threshold
      and never passes it.
    readout: Load factor
    expect: { value: 0.75 }
    setup:
      params: { deletes: 0, grow: 3/4 }
  - id: half-rehash-count
    statement: >-
      Growing past 1/2 (the default) the same 96 keys cost exactly ⌈lg(96 / 2)⌉ = 6 rehashes, one
      more than at 3/4, and leave the table at 256 slots.
    readout: Rehashes
    expect: { value: 6 }
    setup:
      params: { deletes: 0 }
  - id: quarter-shrink-slots
    statement: >-
      Growing past 3/4 and shrinking below 1/4, deleting 86 of the 96 keys (90 %) halves the
      128-slot table twice, exactly: below 32 keys it becomes 64 slots, below 16 it becomes 32, and
      the 10 keys left never fall below 8, so it ends at 32 slots.
    readout: Slots
    expect: { value: 32 }
    setup:
      params: { deletes: 90, grow: 3/4, shrink: 1/4 }
  - id: quarter-shrink-refused-at-half
    statement: >-
      Growing past 1/2, a shrink threshold of 1/4 is not below half of it and is not used: the
      table halves below 1/8 instead, from 256 slots to 128 below 32 keys and to 64 below 16, and
      ends at 64 slots, not the 32 that shrinking below 1/4 would leave.
    readout: Slots
    expect: { value: 64 }
    setup:
      params: { deletes: 90, grow: 1/2, shrink: 1/4 }
---

Double the table once it is more than half full and rehash, keeping every operation constant on average.

A linear-probing table that starts small and doubles as soon as it is more than half full, and halves when it falls below one eighth full; the two thresholds are controls (3/4 and 1/4 the alternatives), and a shrink threshold not below half the grow one is not used. A resize allocates a new table and inserts every key again, which the Rehashes readout and the hash and write counts record.

The load factor stays between the two thresholds once the table has grown, so searches never reach the steep part of the linear-probing curve; the chart's measured points gather in that band, beside Knuth's linear-probing formulas as a reference.

The sizes grow geometrically, so the keys moved by all doublings together stay proportional to the keys inserted: each insert pays a constant amortised share. The gap between the grow and shrink thresholds keeps a table at either boundary from resizing back and forth.
