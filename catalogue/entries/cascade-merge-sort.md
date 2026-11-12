---
id: cascade-merge-sort
title: Cascade merge
taxonomy: sorting/external
status: live
engine: array
labs:
  - sorting
sources:
  - id: betz-1959
    ref: the original description
  - id: knuth-taocp-3
    ref: "5.4.3 The cascade merge"
  - id: gilstad-1960
    ref: the polyphase merge it is compared with
  - id: vitter-2008
    ref: why disks make tape schedules obsolete
tags:
  - sorting
  - external sorting
  - merging
  - tapes
complexity: n log n comparisons in every case; extra space n on tapes
related:
  - balanced-multiway-merge
  - external-merge-sort
  - polyphase-merge-sort
  - tape-merge-sort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites: [polyphase-merge-sort]
  objectives:
  - 'Read the distribution at 512 keys: 23 runs need cascade level 4, [14, 11, 6] runs on three tapes, 8 of them dummy.'
  - 'Follow one cascade in the Phase readout: a three-way merge, a two-way merge and a one-way copy, the fan-in falling within the pass.'
  - 'Read the Phase readout at the end: 3·4 + 1 = 13, the last cascade ending with its single three-way merge.'
  misconceptions:
  - 'The final copy of a cascade merges something; it moves a whole tape onto the one just emptied without a comparison, overhead that Knuth''s rewinding trick avoids.'
algorithm:
  paradigm: divide-and-conquer
  properties:
    stable: false
    in_place: false
bounds:
  model: 'comparisons (memory sorts and merges of up to three runs), array writes (the sorted file written once), auxiliary writes (memory and the four tapes) and phases; no whole pass'
  average: 'on every input of n ≥ 2 keys n array writes and, for the cascade level L holding the r = ⌈n/M⌉ runs, 3L + 1 phases (3 when one run is enough), 13 at 512 keys; comparisons at most the memory sorts'' bound plus 2n per cascade'
claims:
  - id: cascade-phases
    statement: >-
      On Random permutation at 512 keys cascade merging takes 13 phases: run generation, the distribution [14, 11, 6], three cascades of a three-way merge, a two-way merge and a copy, the last cascade's three-way merge, and the final write.
    readout: Phase
    expect: { value: 13 }
    setup:
      params: { shape: random, n: 512, speed: 2000 }
---

A tape sort whose every pass is a cascade: a (T − 1)-way merge onto the empty tape until the shortest input runs out, then a (T − 2)-way merge onto the tape just emptied, and so on down to a two-way merge and a final copy.

After one cascade the tapes again hold a perfect distribution of a lower level, so the pass repeats until one run is left. The distributions are found backwards from the end: with four tapes they run (1, 1, 1), (3, 2, 1), (6, 5, 3), (14, 11, 6). Betz and Carter described the method in 1959, a year before Gilstad's polyphase merge.

The plate simulates the tapes in the auxiliary strip and counts element operations; passes and the amount of tape read are the model in these notes. Start with Random permutation at n = 256 and watch the fan-in drop within each pass; the final copy moves data without merging and is pure overhead.

Comparisons total n log n in every case. Which of cascade and polyphase reads less depends on the number of tapes and on what the drives can do, such as reading backwards. Like polyphase it merges runs from different tapes and is not stable. On disks with random access, a plain k-way merge with the largest possible k replaces both.
