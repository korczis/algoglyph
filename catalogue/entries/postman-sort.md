---
id: postman-sort
title: Postman's sort
taxonomy: sorting/radix
status: live
engine: array
labs:
  - sorting
sources:
  - id: black-2011-postman
    ref: definition and attribution
  - id: sedgewick-2011
    ref: "5.1 String sorts"
tags:
  - sorting
  - radix
  - non-comparison
  - msd
complexity: c·n in every case, c depending on the key length and the number of buckets; extra space n
related:
  - bucket-sort
  - burstsort
  - lsd-radix-sort
  - msd-radix-sort
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites: [msd-radix-sort]
  objectives:
  - 'Read the Array writes: exactly n on every input, each key written once when the buckets are concatenated.'
  - 'Run Few distinct keys at 512 keys: the keys span a single decimal digit, so one distribution and 512 Auxiliary writes; Random permutation needs three digits and 1,528.'
  - 'Explain why there is no comparison: every bucket is chosen by a digit of the key.'
  misconceptions:
  - 'A top-down radix sort gathers the keys back into the array after every digit, as LSD radix sort does; Postman''s sort writes the array once, n = 512 writes at 512 keys.'
algorithm:
  paradigm: divide-and-conquer
  properties:
    in_place: false
    comparison_based: false
bounds:
  model: 'array writes (one per key, the concatenated buckets written back) and auxiliary writes (each cell of the drawn bucket strip that changes); no comparison'
  average: 'no comparison and exactly n array writes on every input; from two keys at least n auxiliary writes, exactly n when the keys span fewer than 10 values, one decimal digit'
claims:
  - id: one-write-per-key
    statement: >-
      On Random permutation at 512 keys Postman's sort makes exactly n = 512 array writes: the buckets of all three decimal digits are formed aside and the array is written once.
    readout: Array writes
    expect: { value: 512 }
    setup:
      params: { shape: random, n: 512, speed: 2000 }
---

Sort the way mail is sorted: distribute the records into buckets by the most significant part of the key, then sort each bucket the same way by the next part, and concatenate the buckets in order.

The NIST dictionary describes it as a highly engineered top-down radix sort in which the attributes of the key are described in advance, so the sort knows how many buckets each attribute needs: country, then city, then street. The kernel treats each decimal digit of the key (offset by the minimum) as an attribute; the lower strip shows each group spread into the buckets of its current digit in arrival order.

There are no key comparisons, so the comparison counter stays at zero, and the time is proportional to c·n, with c set by the key size and the bucket counts; the dictionary draws no distinction between best and worst cases. Unlike LSD radix sort it works from the most significant attribute down and never gathers all records back into one array between passes. Start with Random permutation at n = 256 to see three levels of decimal buckets.

The dictionary credits Robert Ramey's article in the C Users Journal of August 1992; the article itself was not available from a legitimate source, so this description rests on the dictionary. Buckets that keep arrival order make it stable. It suits keys with a natural hierarchy of attributes with known ranges, such as addresses, dates or product codes.
