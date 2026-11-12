---
id: linear-probing
title: Hashing with linear probing
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
  - clustering
complexity: expected ½(1 + 1/(1 − α)) probes per hit and ½(1 + 1/(1 − α)²) per miss
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
  - Step from a key's home slot to the next slot until it finds itself or an empty slot.
  - See primary clustering make the miss cost climb steeply as α approaches 1.
  - Delete by Knuth's backward shift, which leaves no tombstones.
algorithm:
  paradigm: search
bounds:
  model: probes
  average: 'expected ½(1 + 1/(1 − α)) per hit and ½(1 + 1/(1 − α)²) per miss (Knuth, uniform keys)'
---

On a collision try the next slot; watch clusters form and slow everything down.

A key starts at its home slot, the leading bits of its multiplicative hash, and steps to the next slot until it finds itself or an empty slot. Each slot looked at is one probe; slots are coloured by how far their key sits from home.

Keys that hash anywhere into a run of occupied slots extend it, so long runs grow faster than short ones: primary clustering. Knuth's formulas for uniform keys, ½(1 + 1/(1 − α)) probes for a hit and ½(1 + 1/(1 − α)²) for a miss, are drawn as a reference beside the measured means; the miss cost climbs steeply as α approaches 1, and the Longest cluster readout shows why.

Deletion uses Knuth's backward shift (Algorithm R) instead of tombstones: it empties the slot, then walks the rest of the cluster and moves back every key whose home no longer lies between the hole and its slot. The Tombstones readout stays at zero.

Adversarial for h1 sends every key into one narrow band of slots: all the keys end up in a single cluster and the cost of each insert grows with the number of keys already stored.
