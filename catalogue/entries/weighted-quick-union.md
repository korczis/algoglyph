---
id: weighted-quick-union
title: Weighted quick-union
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
  - balanced
complexity: at most lg n links per find
relations:
  - { type: improves_on, target: quick-union, reason: "Linking the smaller tree under the larger bounds every tree's height by lg n." }
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites:
  - quick-union
  objectives:
  - Bound every tree's height by linking the smaller tree under the larger.
  - 'Follow the argument: a site goes one level deeper only when its tree at least doubles.'
algorithm:
  paradigm: union-find
bounds:
  model: array accesses
  worst: find O(lg n), at most lg n links
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
      sites, and a site sinks a level only when its tree at least doubles, so the forest is at
      most ⌊lg 13⌋ + 1 = 4 levels high: a hard bound.
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

Link the smaller tree under the larger, so no tree grows taller than lg n.

Each root also keeps the size of its tree, in the second half of the array. Hanging the smaller tree under the larger root means a site goes one level deeper only when its tree at least doubles, which can happen at most lg n times.

Even the chain input that turns plain quick-union into a path leaves a flat forest here; the test harness checks the lg n bound on the depth of every site, on every input it runs.
