---
id: path-compression
title: Weighted quick-union with path compression
taxonomy: foundations/connectivity
status: live
engine: tree
labs:
  - union-find
sources:
  - id: sedgewick-aic
    ref: "Part 1: Fundamentals"
tags:
  - union-find
  - amortised
complexity: O(m α(n)) array accesses for m operations
relations:
  - { type: improves_on, target: weighted-quick-union, reason: "Flattening every path a find walks makes later finds almost constant." }
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites:
  - weighted-quick-union
  objectives:
  - Flatten every path a find walks, so later finds from those sites take one step.
  - 'Read the amortised bound of weighting with compression: α(n), at most four in practice.'
algorithm:
  paradigm: union-find
bounds:
  model: array accesses
  worst: O(m α(n)) for m operations, amortised
claims:
  - id: half-per-site-components-identity
    statement: >-
      At 0.5 unions per site the 24 sites get m = ⌈0.5 · 24⌉ = 12 connections, and each one either
      merges two components or finds its sites connected already, so Components minus the
      connected count is n − m = 12, exactly.
    readout: Components
    expect: { against: Already connected, against_number: 1, offset: 12, tolerance: 0 }
    setup:
      params: { perSite: 0.5 }
  - id: one-per-site-components-identity
    statement: >-
      At 1 union per site the 24 sites get m = 24 connections, so Components minus the connected
      count is n − m = 0, exactly: every connection either merged or was already connected.
    readout: Components
    expect: { against: Already connected, against_number: 1, offset: 0, tolerance: 0 }
    setup:
      params: { perSite: 1 }
  - id: half-per-site-height-bound
    statement: >-
      At 0.5 unions per site (m = 12 connections over 24 sites) no tree holds more than m + 1 = 13
      sites, and a site sinks a level only when its tree at least doubles, and compression only
      shortens paths, so the forest is at most ⌊lg 13⌋ + 1 = 4 levels high: a hard bound.
    readout: Height
    expect: { below: 5 }
    setup:
      params: { perSite: 0.5 }
  - id: one-per-site-height-bound
    statement: >-
      At 1 union per site (m = 24 connections) a tree can hold all 24 sites, so the bound is
      ⌊lg 24⌋ + 1 = 5 levels (⌊lg n⌋ links below the root): a hard bound.
    readout: Height
    expect: { below: 6 }
    setup:
      params: { perSite: 1 }
---

Point every node a find passes straight at the root, making each operation almost constant time.

After a find reaches the root, a second pass climbs the same path again and points each site on it at the root, one write per site. The next find from any of them takes a single step, and the forest flattens as it is used.

This kernel compresses fully, in two passes; path halving, which points every other site at its grandparent in one pass, has the same bound. Combined with weighting, the amortised cost per operation is bounded by the inverse Ackermann function α(n), which does not exceed four for any input a physical computer can hold.
