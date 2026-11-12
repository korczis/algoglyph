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
related:
  - binary-search
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
---

Look at every key until the one wanted turns up, or the list ends.

With keys in no particular order, the only way to find one is to compare it with every key in turn. Searches here follow a Zipf distribution: the key of popularity rank r is sought with probability proportional to 1/rˢ, the skewed pattern many real lookups follow.

Self-organising lists exploit the skew. Move-to-front puts every key found at the head, so popular keys gather where the scan starts; transpose swaps a found key one place forward, adapting more slowly but disturbing the list less. Bar height shows how often each key is sought, so a well-organised list slopes down from the left.

The chart is the mean probe count over the most recent searches: with move-to-front or transpose it falls as the list adapts, and with the list left alone it stays where the random starting order puts it.
