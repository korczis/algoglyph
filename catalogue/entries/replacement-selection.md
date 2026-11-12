---
id: replacement-selection
title: Replacement selection
taxonomy: sorting/external
status: live
engine: tree
sources:
  - id: sedgewick-aic
    ref: "Part 3: Sorting"
tags:
  - external sorting
  - priority queue
  - runs
complexity: lg M compares per key; runs of expected length 2M on random input
related:
  - binary-heap
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites: [binary-heap]
  objectives:
  - 'Run Random order with 255 keys and M = 8: 17 runs, 15.00 keys on average, close to 2M.'
  - 'Run Ascending: one run whatever M is.'
  - 'Run Descending: runs of exactly M keys, the last one holding what is left.'
  misconceptions:
  - 'Runs can never be longer than the memory that forms them; replacement selection keeps adding keys that are not smaller than the last one written, so on Random order runs average about 2M, and Ascending input is a single run.'
bounds:
  model: 'Runs written and Average run length (keys per run), with Key comparisons and Array reads / writes of the heap'
  average: 'every run but the last holds at least M keys on every input; Ascending gives one run, and Descending with M ≤ n gives ⌊n/M⌋ runs of exactly M and one of n mod M when that is not 0; runs of expected length 2M on random input are Knuth''s result, which the tree harness measures at 6,000 keys'
claims:
  - id: runs-near-twice-memory
    statement: >-
      On Random order with 255 keys and a memory of M = 8 keys, replacement selection writes 17 runs of 15.00 keys on average, close to the 2M = 16 of Knuth's analysis and nearly twice what sorting memory loads would give.
    readout: Average run length
    expect: { value: 15 }
    setup:
      params: { shape: random, n: 255 }
---

A priority queue that produces initial runs about twice the size of memory.

Each heap value packs a run number above the key, so the minimum is the smallest key of the current run, and keys held back for the next run sort after all of them. Heap cells and nodes are coloured by run; the output strip shows the runs as they are written, separated by gaps.

Every run except the last holds at least M keys, because a run ends only when all M keys in memory belong to the next one; on random input the expected length is 2M, which the test harness measures. Ascending input comes out as a single run, and descending input as runs of exactly M, the last one holding what is left.
