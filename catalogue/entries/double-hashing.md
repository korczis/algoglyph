---
id: double-hashing
title: Double hashing
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
  - open addressing
complexity: expected (1/α) ln(1/(1 − α)) probes per hit and 1/(1 − α) per miss (uniform probing)
related:
  - linear-probing
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites:
  - linear-probing
  objectives:
  - Step by 1 + h2(k) mod (m − 1), with h2 unrelated to h1 and m prime, so every slot can be reached.
  - See why keys with the same home slot take different steps, so clusters do not merge.
  - See tombstones left by deletes lengthen later probe sequences.
algorithm:
  paradigm: search
bounds:
  model: probes
  average: 'close to uniform probing: expected (1/α) ln(1/(1 − α)) per hit and 1/(1 − α) per miss'
claims:
  - id: six-shared-bits-hits-off-home
    statement: >-
      With adversarial keys sharing 6 leading hash bits and no deletions, the 96 keys get a table
      of 131 slots (the prime after ⌈96 / 0.75⌉ = 128), and their homes fall in at most
      ⌈131 / 64⌉ + 1 = 4 slots; at most 4 of the 48 keys a batch searches for sit at home, so the
      hits take at least (4 + 2 · 44) / 48 ≈ 1.92 probes on average, a hard bound.
    readout: Probes per search
    expect: { above: 1.91 }
    setup:
      params: { stream: adversarial, deletes: 0, band: 6 }
  - id: three-shared-bits-hits-off-home
    statement: >-
      With 3 shared bits the homes fall in at most ⌈131 / 8⌉ + 1 = 18 slots, so at most 18 of the
      48 searched keys sit at home and the hits take at least (18 + 2 · 30) / 48 = 1.625 probes on
      average, a hard bound.
    readout: Probes per search
    expect: { above: 1.62 }
    setup:
      params: { stream: adversarial, deletes: 0, band: 3 }
---

Probe with a step from a second hash, which breaks up the clusters of linear probing.

The first probe is the home slot of h1; on a collision the step is 1 + h2(k) mod (m − 1), where h2 is the MurmurHash3 finaliser, a hash unrelated to h1. The table size is rounded up to a prime, so every step is coprime with it and the sequence can reach every slot. h2 is evaluated only on the first collision, which the Hash evaluations readout shows.

Two keys with the same home slot almost always take different steps, so clusters do not merge the way they do under linear probing. The scheme comes close to uniform probing, whose expected costs, (1/α) ln(1/(1 − α)) probes for a hit and 1/(1 − α) for a miss, the chart draws as a reference.

Deletion leaves a tombstone: searches pass over it and inserts reuse the first one they pass. After the deletes, tombstones still lengthen probe sequences, so the measured misses lie above the formula at the remaining load factor.

Adversarial for h1 starts every key in one narrow band, yet the different steps spread them across the whole table; compare the same stream on #/p/linear-probing.
