---
id: diff3-merge
title: Three-way merge
taxonomy: strings/diff
status: live
engine: string
sources:
  - id: practice-systems
tags:
  - merge
  - diff3
  - conflicts
motivation: Coordinating many workers and machines without a shared clock depends on it.
complexity: "O((N + M) D) for the two diffs, then linear in the lines"
related:
  - myers-diff
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites:
  - myers-diff
  objectives:
  - Diff the ancestor against each side and call an ancestor line matched in both stable.
  - Take the changed side of a chunk only one side changed, and a change both made identically once.
  - Write a conflict between markers where both sides changed a chunk differently.
bounds:
  model: line comparisons and chunks resolved
  worst: 'O((N + M) D) line comparisons for the two diffs; then at most one chunk per line of the three versions'
claims:
  - id: every-12-conflicts-bound
    statement: >-
      Every conflict is one of the changed chunks, so at one edit per 12 of n = 40 lines the
      Conflicts readout is at most Changed chunks: their difference is below 1.
    readout: Conflicts
    expect: { against: Changed chunks, against_number: 1, below: 1 }
    setup:
      params: { n: 40, every: 12 }
  - id: every-12-changed-chunks-bound
    statement: >-
      At one edit per 12 of 40 lines each side makes k = round(40 / 12) = 3 edits, at most 2k edit
      steps each, and every changed chunk holds a run of at least one side's steps between stable
      lines: at most 4k = 12 changed chunks.
    readout: Changed chunks
    expect: { range: [0, 12] }
    setup:
      params: { n: 40, every: 12 }
  - id: default-changed-chunks-bound
    statement: >-
      At the defaults each side makes round(12 / 6) = 2 edits of the 12 ancestor lines, so there
      are at most 4 × 2 = 8 changed chunks, by the same count.
    readout: Changed chunks
    expect: { range: [0, 8] }
---

Two edits of one ancestor combined; where both touched the same lines a conflict remains.

The ancestor is diffed against each side with Myers' algorithm. An ancestor line matched in both diffs is stable. Between stable lines lie unstable chunks: if only one side changed a chunk, that side's lines are taken; if both made the same change it is taken once; if both changed it differently the merge writes a conflict with both versions between markers. The chips are coloured by which of these each line fell into.

The ancestor's lines are generated as configuration settings and each side edits a few regions at random, one per 6 lines unless Lines per edit changes it, so some runs merge cleanly and some overlap. The readouts count the changed chunks and the conflicts left.
