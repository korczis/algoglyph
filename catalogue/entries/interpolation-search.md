---
id: interpolation-search
title: Interpolation search
taxonomy: searching/elementary
status: live
engine: custom
sources:
  - id: sedgewick-aic
    ref: "Part 4: Searching"
tags:
  - search
  - sorted array
  - interpolation
complexity: 'about lg lg n probes on uniformly spread keys, O(n) in the worst case'
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites:
  - binary-search
  objectives:
  - Probe where the key would sit if the keys between the interval's ends were spread evenly.
  - See why uniformly spread keys need about lg lg n probes, far fewer than lg n.
  - See how keys spread on a log scale push the guess to one side, past the cost of binary search.
algorithm:
  paradigm: search
bounds:
  model: probes
  average: about lg lg n on uniformly spread keys
---

Guess where the key should be from its value, not the middle: lg lg n on uniform keys.

Binary search ignores the key's value and always probes the middle. Interpolation search probes where the key would sit if the keys between the interval's ends were spread evenly: lo + (key − a[lo]) · (hi − lo) / (a[hi] − a[lo]).

On keys spread uniformly it needs about lg lg n probes on average, far fewer than lg n. On keys spread on a log scale, dense at the small end and sparse at the large end, the straight-line guess keeps landing too far to one side and the search can do worse than binary search. The chart runs binary search on the same keys and the same queries for comparison.

The probe map below the bars places every probe at its position and step, so long jumps between successive guesses show where the linear estimate went wrong.
