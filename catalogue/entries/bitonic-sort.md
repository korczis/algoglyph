---
id: bitonic-sort
title: Bitonic sort
taxonomy: sorting/networks
status: live
engine: array
labs:
  - sorting
sources:
  - id: batcher-1968
    ref: the original construction
  - id: knuth-taocp-3
    ref: "5.3.4 Networks for sorting"
  - id: sanders-2019
    ref: sorting networks in practice
tags:
  - sorting
  - sorting network
  - oblivious
  - in-place
  - parallel
  - bitonic merge
complexity: n log² n in every case; extra space 1
related:
  - batcher-merge-exchange
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites: [batcher-merge-exchange]
  objectives:
  - 'Run Random permutation and Already sorted at 512 keys: 11,520 comparisons and 45 rounds on both, (n/2)·k(k + 1)/2 and k(k + 1)/2 for n = 2^k.'
  - 'Run 100 keys: the Rounds readout shows the 28 rounds of the 128-key network, while the comparators that would touch a missing key are dropped, 1,334 of them left instead of 1,792.'
  - 'Explain why every round is one parallel step: its comparators touch disjoint keys.'
  misconceptions:
  - 'Bitonic sort is the cheapest of Batcher''s networks; his odd-even merge needs fewer comparators in the same depth, 9,727 against 11,520 at 512 keys, both in 45 rounds.'
algorithm:
  paradigm: divide-and-conquer
  properties:
    stable: false
    in_place: true
bounds:
  model: 'comparators (one comparison each, and an exchange of two writes when its keys are out of order) and rounds (one layer of disjoint comparators); no auxiliary write'
  average: 'the same network on every input: at n = 2^k exactly (n/2)·k(k + 1)/2 comparators in k(k + 1)/2 rounds, 11,520 in 45 at 512 keys; at any other n the k(k + 1)/2 rounds of the next power of two 2^k and fewer comparators; no write on Already sorted'
claims:
  - id: same-comparisons-on-sorted-input
    statement: >-
      On Already sorted at 512 keys bitonic sort makes (n/2)·k(k + 1)/2 = 11,520 comparisons for k = 9, exactly as many as on every other input of that size: nothing in its schedule depends on the keys.
    readout: Comparisons
    expect: { value: 11520 }
    setup:
      params: { shape: sorted, n: 512, speed: 2000 }
---

Batcher's bitonic network: sort pairs in alternating directions so that neighbours form a sequence that rises then falls, merge those bitonic blocks with half-cleaners, and double the block size until one merge orders the whole array.

A bitonic merge of a block compares keys half a block apart, which splits it into two bitonic halves with every key of the left one no larger than every key of the right one, then repeats on the halves. Correctness is usually argued with the zero-one principle: a comparator network that sorts every input of zeros and ones sorts every input. The plate runs the network round by round, one comparator after another, and counts the total work; the parallel time is the depth, on the order of log² n rounds.

For n = 2^k the network has k(k + 1)/2 layers of n/2 comparators, so it pays a factor log n over the n log n optimum in exchange for a perfectly regular schedule. Start with Random permutation at n = 64, then switch to Already sorted: the compare count does not move, because nothing in the schedule depends on the keys. Other sizes are handled as if padded to the next power of two with keys larger than all others.

It is in place but not stable, since exchanges across long distances jump over equal keys. Its home is hardware, SIMD registers, GPUs and the small base cases of larger sorts, where a fixed schedule without data-dependent branches is worth more than the fewest comparisons; for one thread on large data an n log n sort does less work.
