---
id: sequential-search
title: Sequential search
taxonomy: searching/elementary
status: live
engine: custom
sources:
  - id: sedgewick-aic
    ref: "Part 4: Searching"
tags:
  - search
  - symbol table
complexity: 'O(n) per search; a hit costs its position, a miss the whole list'
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  objectives:
  - Compare the key with every key in turn, the only way to search keys in no particular order.
  - See how move-to-front and transpose exploit a skewed (Zipf) search pattern.
algorithm:
  paradigm: search
bounds:
  model: probes
  worst: 'n probes on a miss; a hit at position i costs i'
claims:
  - id: misses-scan-the-whole-list
    statement: >-
      A miss looks at every key: 50 searches for keys never stored, on a list of 96, take exactly 50
      · 96 = 4800 probes, whatever the list's order.
    readout: Probes in all
    expect: { value: 4800 }
    setup:
      params: { n: 96, strategy: static, hit: 0, runs: 50 }
  - id: uniform-popularity-static
    statement: >-
      With every key equally popular (skew 0) and the list left alone, 1000 hits on 96 keys take
      49310 probes, a mean of about 49.3 near the (n + 1) / 2 = 48.5 of a uniformly placed key,
      recomputed by a list search written in the test.
    readout: Probes in all
    expect: { value: 49310 }
    setup:
      params: { n: 96, strategy: static, skew: 0, hit: 1, runs: 1000 }
  - id: zipf-popularity-static
    statement: >-
      With Zipf popularity (skew 1) and the list left alone, 1000 hits take 43139 probes: popular
      keys are no nearer the front than the shuffle put them, recomputed by a list search written in
      the test.
    readout: Probes in all
    expect: { value: 43139 }
    setup:
      params: { n: 96, strategy: static, skew: 1, hit: 1, runs: 1000 }
  - id: zipf-popularity-move-to-front
    statement: >-
      With the same Zipf queries and moving each key found to the front, the 1000 hits take 26657
      probes, about 62 % of the static list's 43139, recomputed by a list search written in the
      test.
    readout: Probes in all
    expect: { value: 26657 }
    setup:
      params: { n: 96, strategy: move-to-front, skew: 1, hit: 1, runs: 1000 }
  - id: zipf-popularity-transpose
    statement: >-
      With the same Zipf queries and swapping each key found one place forward, the 1000 hits take
      33393 probes: transposition drifts popular keys forward more slowly than moving them to the
      front, recomputed by a list search written in the test.
    readout: Probes in all
    expect: { value: 33393 }
    setup:
      params: { n: 96, strategy: transpose, skew: 1, hit: 1, runs: 1000 }
---

Look at every key until the one wanted turns up, or the list ends.

With keys in no particular order, the only way to find one is to compare it with every key in turn. Searches here follow a Zipf distribution: the key of popularity rank r is sought with probability proportional to 1/rˢ, the skewed pattern many real lookups follow.

Self-organising lists exploit the skew. Move-to-front puts every key found at the head, so popular keys gather where the scan starts; transpose swaps a found key one place forward, adapting more slowly but disturbing the list less. Bar height shows how often each key is sought, so a well-organised list slopes down from the left.

The chart is the mean probe count over the most recent searches: with move-to-front or transpose it falls as the list adapts, and with the list left alone it stays where the random starting order puts it.
