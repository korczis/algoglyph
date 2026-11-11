---
id: levenshtein-matrix
title: Levenshtein distance
taxonomy: strings/similarity
status: planned
engine: string
sources:
  - id: practice-entity-resolution
tags:
  - edit distance
  - dynamic programming
  - fuzzy matching
motivation: Resolving one company or person across noisy public registries needs it.
related:
  - longest-common-subsequence
  - myers-diff
---

The edit table filled cell by cell, and the cheapest path of insertions, deletions and substitutions through it.
