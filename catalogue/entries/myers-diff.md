---
id: myers-diff
title: Myers diff
taxonomy: strings/diff
status: live
engine: string
sources:
  - id: practice-systems
tags:
  - diff
  - edit graph
  - shortest edit script
motivation: Coordinating many workers and machines without a shared clock depends on it.
complexity: "O((N + M) D) time for versions of N and M tokens that differ by D edits"
related:
  - levenshtein-matrix
  - diff3-merge
relations:
  - { type: compares_with, target: longest-common-subsequence, reason: "The longest common subsequence has (N + M − D)/2 tokens: the same answer by dynamic programming." }
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  objectives:
  - Read the edit graph, a step right a deletion, a step down an insertion and a diagonal free where tokens are equal.
  - Extend in round d the furthest-reaching path on every diagonal from −d to d, then slide it along equal tokens.
  - Read D, the shortest edit script's length, from the first round to reach the far corner, and the LCS as (N + M − D)/2.
bounds:
  model: paths extended and token comparisons
  worst: 'd + 1 paths extended in round d, at most (D + 1)(D + 2)/2 in all; O((N + M) D) token comparisons'
---

The shortest edit script found as the furthest-reaching paths along the diagonals of the edit graph.

The table is the edit graph: a step right deletes a token of the old version (the columns), a step down inserts one of the new (the rows), and a diagonal step is free where the two tokens are equal. Round d extends, on each diagonal k = x − y from −d to d, the furthest-reaching path with d edits from its neighbour, then slides it along its diagonal as far as the tokens agree; cells are coloured by the round that reached them.

The first round to reach the far corner gives D, the length of the shortest edit script, and the path read back from the saved rounds is marked through the table; the longest common subsequence has (N + M − D)/2 tokens. The chart plots how far into the old version the best path of each round reaches.
