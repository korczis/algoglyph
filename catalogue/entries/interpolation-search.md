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
claims:
  - id: evenly-spaced-keys-one-probe
    statement: >-
      On evenly spaced keys a[i] = 8i the first guess for a present key a[i] is lo + ⌊(8i − 8lo)(hi
      − lo) / (8hi − 8lo)⌋ = i, exactly, because the numerator is a multiple of the span: none of
      200 searches for present keys among 128 takes a second probe.
    readout: Most probes in one search
    expect: { value: 1 }
    setup:
      params: { n: 128, spread: even, hit: 1, runs: 200 }
  - id: evenly-spaced-keys-probes-in-all
    statement: >-
      The same 200 searches on a[i] = 8i take exactly 200 probes in all, one each.
    readout: Probes in all
    expect: { value: 200 }
    setup:
      params: { n: 128, spread: even, hit: 1, runs: 200 }
  - id: uniform-keys-probes-in-all
    statement: >-
      On 1024 keys drawn uniformly at random, 500 searches for present keys take 1430 probes in all,
      a mean of about 2.9, near lg lg 1024 ≈ 3.3, recomputed by an interpolation search written in
      the test with exact integer arithmetic.
    readout: Probes in all
    expect: { value: 1430 }
    setup:
      params: { n: 1024, spread: uniform, hit: 1, runs: 500 }
  - id: uniform-keys-binary-search-beside
    statement: >-
      Binary search on the same 1024 keys and the same 500 queries takes 4501 probes in all, a mean
      of about 9.0 against interpolation's 2.9, recomputed by a binary search written in the test.
    readout: Probes in all, binary search on the same keys
    expect: { value: 4501 }
    setup:
      params: { n: 1024, spread: uniform, hit: 1, runs: 500 }
  - id: log-spread-keys-worst-search
    statement: >-
      On 1024 keys spread on a log scale the straight-line guess keeps landing on the dense side:
      the worst of 200 searches for present keys takes 93 probes, where binary search never needs
      more than ⌊lg 1024⌋ + 1 = 11.
    readout: Most probes in one search
    expect: { value: 93 }
    setup:
      params: { n: 1024, spread: logarithmic, hit: 1, runs: 200 }
---

Guess where the key should be from its value, not the middle: lg lg n on uniform keys.

Binary search ignores the key's value and always probes the middle. Interpolation search probes where the key would sit if the keys between the interval's ends were spread evenly: lo + (key − a[lo]) · (hi − lo) / (a[hi] − a[lo]).

On keys spread uniformly it needs about lg lg n probes on average, far fewer than lg n. On keys spread on a log scale, dense at the small end and sparse at the large end, the straight-line guess keeps landing too far to one side and the search can do worse than binary search. The chart runs binary search on the same keys and the same queries for comparison.

Two inputs show the two sides of the estimate. On evenly spaced keys (a[i] = 8i) the guess is exact: the numerator (key − a[lo]) · (hi − lo) is a multiple of the span a[hi] − a[lo], so the integer division lands on the key and every present key is found with one probe. On keys drawn uniformly at random the guess is only close, and the search needs a few probes, near lg lg n, the bound Perl, Itai and Avni proved for that case: about 3 at n = 1024, where binary search needs about 10.

The probe map below the bars places every probe at its position and step, so long jumps between successive guesses show where the linear estimate went wrong.
