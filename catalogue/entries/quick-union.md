---
id: quick-union
title: Quick-union
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
  - forest
complexity: proportional to the tree height per find, n in the worst case
relations:
  - { type: variant_of, target: quick-find, reason: "Cheap unions, at the price of finds that climb a tree." }
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  prerequisites:
  - quick-find
  objectives:
  - Make a union cheap by linking one root under the other.
  - 'See why nothing keeps the trees short: the chain input turns the forest into a single path.'
algorithm:
  paradigm: union-find
bounds:
  model: array accesses
  worst: find O(n) on the chain input; union is two finds and one write
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
      At 0.5 unions per site (m = 12 connections over 24 sites) the forest is at most 13 levels
      high: a merging union hangs one root under another and adds at most one level, so the height
      is at most min(m, n − 1) + 1 = 13, a hard bound below the 24 a path of every site would be.
    readout: Height
    expect: { below: 14 }
    setup:
      params: { perSite: 0.5 }
  - id: one-per-site-chain-is-a-path
    statement: >-
      On the chain input at 1 union per site the forest is one path of all 24 sites, exactly 24
      levels: the chain's 23 links come first and each hangs the root so far under the next site;
      the one connection left over finds its sites connected already.
    readout: Height
    expect: { value: 24 }
    setup:
      params: { shape: chain, perSite: 1 }
---

Each object points to a parent; a union links one root under the other and a find climbs to the root.

A find climbs parent links to the root, one array read per link; a union is two finds and one write. Nothing keeps the trees short: on the chain input each union hangs a root under its neighbour, the forest becomes a single path, and a find from its far end climbs every site.

The height is measured on the replayed forest after every union, and the chart sets it against lg(n+1) so the difference from the weighted version is visible on the same input.
