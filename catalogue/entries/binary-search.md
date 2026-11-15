---
id: binary-search
title: Binary search
taxonomy: searching/elementary
status: live
engine: custom
sources:
  - id: sedgewick-aic
    ref: "Part 4: Searching"
tags:
  - search
  - sorted array
  - divide and conquer
complexity: 'at most ⌊lg n⌋ + 1 probes'
related:
  - interpolation-search
  - sequential-search
  - bst-search-insert
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  objectives:
  - Keep an interval that must hold the key and halve it by probing its middle.
  - See why at most ⌊lg n⌋ + 1 probes are needed, whether the key is found or not.
  - Read the probe map as the implicit balanced binary search tree.
algorithm:
  paradigm: search
bounds:
  model: probes
  worst: '⌊lg n⌋ + 1 probes, hit or miss'
claims:
  - id: misses-on-a-power-of-two
    statement: >-
      On 128 = 2^7 keys every one of the default seed's 200 misses costs exactly ⌊lg 128⌋ = 7
      probes: each interval splits into a left part no larger than its right, so only the path
      that goes right every time reaches the eighth probe the ⌊lg n⌋ + 1 bound allows, a miss
      above the second-largest key, and none of these misses lies there.
    readout: Most probes in one search
    expect: { value: 7 }
    setup:
      params: { n: 128, hit: 0, runs: 200 }
  - id: misses-probes-in-all
    statement: >-
      The same 200 misses on 128 keys take 200 · 7 = 1400 probes in all, recomputed by a binary
      search written in the test.
    readout: Probes in all
    expect: { value: 1400 }
    setup:
      params: { n: 128, hit: 0, runs: 200 }
  - id: hits-probes-in-all
    statement: >-
      200 searches for present keys among 128 take 1203 probes in all, a mean of about 6.0 against
      the 7 of a miss: a hit can stop early, recomputed by a binary search written in the test.
    readout: Probes in all
    expect: { value: 1203 }
    setup:
      params: { n: 128, hit: 1, runs: 200 }
  - id: misses-on-1024-keys
    statement: >-
      On 1024 = 2^10 keys the default seed's 100 misses each cost exactly ⌊lg 1024⌋ = 10 probes, for
      the same reason as on 128 keys.
    readout: Most probes in one search
    expect: { value: 10 }
    setup:
      params: { n: 1024, hit: 0, runs: 100 }
---

Halve the sorted interval that can hold the key, lg n times at most.

Keep an interval of the sorted array that must hold the key if it is present, probe its middle and discard the half that cannot hold it. At most ⌊lg n⌋ + 1 probes are needed, whether the key is found or not.

The bars are the keys, the shaded band is the interval still in play and the horizontal line is the key sought. Below, every probe ever made is placed at its position in the array and its step in the search, joined to the probe after it. A position is always probed at the same step, so the map is the implicit balanced binary search tree.

Searches look for a stored key with the chosen probability and otherwise for a key not stored; the readouts and the chart count the probes of every search from the run.
