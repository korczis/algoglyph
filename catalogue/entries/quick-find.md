---
id: quick-find
title: Quick-find
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
  - connectivity
complexity: "one array access per find, n per union: quadratic for n unions"
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  objectives:
    - Answer connectivity queries with one array look-up, and see what unions cost for it.
algorithm:
  paradigm: union-find
bounds:
  model: array accesses
  best: find O(1)
  worst: union O(n), n unions O(n²)
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
  - id: half-per-site-star-height
    statement: >-
      At 0.5 unions per site the forest is 2 levels high, exactly: every site points at the site
      that labels its component, which points at itself, and the first connection always merges.
    readout: Height
    expect: { value: 2 }
    setup:
      params: { perSite: 0.5 }
  - id: one-per-site-star-height
    statement: >-
      At 1 union per site the forest is still 2 levels high, exactly, for the same reason: a
      component is a star under its label, however many connections are made.
    readout: Height
    expect: { value: 2 }
    setup:
      params: { perSite: 1 }
---

Every object carries its component id, so a find is one look-up and a union rewrites every member of one side.

The plate draws the id array as a forest: every site hangs directly under the site whose index is its component id, so each tree is a star one level deep. The strip below the forest is the array itself, and the cells highlighted during a union are the ones the scan rewrote.

A find costs one array read, but every union reads all n entries, whatever the sizes of the two components. Each read and write is counted as performed; in the union-find lab this kernel's cost per union grows in proportion to n. Plain quick-union grows too, with the height of its trees, and only the weighted versions stay nearly flat.
