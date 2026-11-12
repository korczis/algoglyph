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
---

Two edits of one ancestor combined; where both touched the same lines a conflict remains.

The ancestor is diffed against each side with Myers' algorithm. An ancestor line matched in both diffs is stable. Between stable lines lie unstable chunks: if only one side changed a chunk, that side's lines are taken; if both made the same change it is taken once; if both changed it differently the merge writes a conflict with both versions between markers. The chips are coloured by which of these each line fell into.

The ancestor's lines are generated as configuration settings and each side edits a few regions at random, so some runs merge cleanly and some overlap. The readouts count the changed chunks and the conflicts left.
