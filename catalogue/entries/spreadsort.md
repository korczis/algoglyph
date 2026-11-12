---
id: spreadsort
title: Spreadsort
taxonomy: sorting/radix
status: live
engine: array
labs:
  - sorting
sources:
  - id: ross-2002
    ref: the original description
  - id: ross-2017
    ref: Boost.Sort integer_sort documentation
tags:
  - sorting
  - radix
  - in-place
  - hybrid
complexity: linear on well-spread keys; worst case the better of n log n and n log(b/s + s) for b-bit keys; extra space proportional to the key length
motivation: Boost.Sort ships it as integer_sort, float_sort and string_sort, drop-in alternatives to std::sort.
related:
  - american-flag-sort
  - msd-radix-sort
  - pdqsort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites: [american-flag-sort]
  objectives:
  - 'Run Already sorted at 512 keys: the scan for the minimum and the maximum notices the order, 3(n − 1) = 1,533 comparisons and no write.'
  - 'Run Random permutation at 512 keys: one spreading pass into n bins of one key each, with the scan''s 2(n − 1) comparisons plus one per key up to the first descent, and n − c exchanges for the c cycles of the permutation.'
  - 'Explain why the kernel never reaches its comparison sort on a plate input of 16 keys or more: the keys span fewer values than there are keys, so every bin of the first pass holds equal keys.'
  misconceptions:
  - 'A hybrid radix sort spends its comparisons sorting the bins; on every plate input of 16 keys or more Spreadsort''s only comparisons are the scan for the extremes, between 2(n − 1) + 1 and 3(n − 1).'
algorithm:
  paradigm: divide-and-conquer
  properties:
    stable: false
    in_place: true
bounds:
  model: 'comparisons (the scan for the minimum and the maximum, three per key while the run is ascending and two after) and array writes (each exchange two); no auxiliary write'
  best: 'Already sorted: 3(n − 1) comparisons and no write, from 16 keys on'
  average: 'on every plate input of n ≥ 16 keys exactly 2(n − 1) + f comparisons, f the position of the first descent (n − 1 when there is none); on a permutation of 1..n, n − c exchanges for its c cycles; below 16 keys an exchange insertion sort'
claims:
  - id: sorted-detected-by-the-scan
    statement: >-
      On Already sorted at 512 keys Spreadsort makes 3(n − 1) = 1,533 comparisons, all of them in the scan for the minimum and the maximum, which finds the run sorted, and no write.
    readout: Comparisons
    expect: { value: 1533 }
    setup:
      params: { shape: sorted, n: 512, speed: 2000 }
---

Find the minimum and maximum, split the range between them into bins by the top bits in which the keys still differ, move the keys into their bins in place, and either spread each bin again or finish it with a comparison sort.

The decision at every level is what makes it a hybrid: Spreadsort spreads by bits while that guarantees the better worst case, and hands a bin to comparison sorting when that does. The Boost documentation states the worst case as the better of n log n comparisons and n log(b/s + s) operations for b-bit keys, which is why it copes with clustered data that many radix sorts handle badly.

Boost hands inputs below about a thousand elements straight to std::sort; the kernel lowers that threshold to small bins so the spreading is visible on the plate's sizes. Start with Random permutation at n = 256: the plate's keys span no more values than there are keys, so one spreading pass puts every key into a bin of its own and no comparison sort runs at all; the comparisons are those of the scan for the minimum and the maximum. Then try Already sorted, which that scan detects.

Ross's 2002 paper reports linear time for continuous integrable key distributions. The Boost tables list it as unstable and using memory proportional to the key length rather than to n; for a stable sort of integer keys, LSD radix sort is the comparison.
