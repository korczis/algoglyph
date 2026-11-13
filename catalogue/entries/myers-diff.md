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
claims:
  - id: every-12-distance-identity
    statement: >-
      At one edit per 12 of n = 48 tokens the new version has M = 45 and an independent dynamic
      programme finds a longest common subsequence of 44, so D = N + M − 2·LCS = 48 + 45 − 88 =
      5, exactly.
    readout: Edit distance D
    expect: { value: 5 }
    setup:
      params: { n: 48, every: 12 }
  - id: every-12-lcs-identity
    statement: >-
      The plate's longest common subsequence there, (N + M − D)/2, is the dynamic programme's 44,
      exactly, and at most min(N, M) = 45.
    readout: Longest common subsequence
    expect: { value: 44 }
    setup:
      params: { n: 48, every: 12 }
  - id: every-8-distance-bound
    statement: >-
      At one edit per 8 of 48 tokens the input makes k = round(48 / 8) = 6 edits, each deleting or
      inserting at most two tokens or replacing one (two edit steps), so D is at most 2k = 12.
    readout: Edit distance D
    expect: { range: [0, 12] }
    setup:
      params: { n: 48, every: 8 }
  - id: every-8-lines-distance-identity
    statement: >-
      On lines at one edit per 8 of 48 the versions have N = M = 48 and the dynamic programme's
      LCS is 43, so D = 96 − 86 = 10, exactly.
    readout: Edit distance D
    expect: { value: 10 }
    setup:
      params: { shape: lines, n: 48, every: 8 }
---

The shortest edit script found as the furthest-reaching paths along the diagonals of the edit graph.

The table is the edit graph: a step right deletes a token of the old version (the columns), a step down inserts one of the new (the rows), and a diagonal step is free where the two tokens are equal. Round d extends, on each diagonal k = x − y from −d to d, the furthest-reaching path with d edits from its neighbour, then slides it along its diagonal as far as the tokens agree; cells are coloured by the round that reached them.

The first round to reach the far corner gives D, the length of the shortest edit script, and the path read back from the saved rounds is marked through the table; the longest common subsequence has (N + M − D)/2 tokens. The chart plots how far into the old version the best path of each round reaches.
