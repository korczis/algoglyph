---
id: simd-sorting-network
title: SIMD sorting network
taxonomy: sorting/networks
status: planned
engine: array
labs:
  - sorting
sources:
  - id: chhugani-2008
    ref: SIMD merge sort with in-register networks
  - id: inoue-2007
    ref: AA-sort and aligned memory access
  - id: batcher-1968
    ref: the bitonic merge network
tags:
  - sorting
  - sorting network
  - oblivious
  - parallel
  - simd
  - vectorisation
complexity: n log n in every case; extra space n
related:
  - batcher-merge-exchange
  - bitonic-sort
  - mergesort-top-down
---

A mergesort whose comparators are vector instructions: sort small blocks inside registers with a fixed network of min and max operations, transpose them into sorted runs, and merge runs with a bitonic merge network executed register against register.

A comparator is just a minimum and a maximum, and a vector unit computes the minimum or maximum of every lane of a register at once, so one pair of instructions performs as many comparators as the register has lanes. A sorting network has no data-dependent branches, which is exactly what such instructions need; the bitonic merge fits especially well, because each of its layers compares keys a fixed distance apart, a lane-wise comparison of two registers followed by a fixed shuffle.

The plate models four-lane registers, one lane per vector lane: blocks of sixteen keys are sorted by the optimal four-input network across registers and transposed, then runs of four, eight, sixteen and onwards are merged by the vectorised bitonic kernel. It counts total work and runs the lanes one after another; inputs are padded to a multiple of sixteen as vector code pads. Start with Random permutation at n = 64 and watch the in-register phase finish before the first merge.

The network changes only the constant, not the order: the whole sort makes on the order of n log n comparisons and needs linear extra space, and the min and max network does not preserve the order of equal keys. It pays off for large arrays of primitive keys on processors with wide vector registers; Inoue and colleagues found aligned memory access essential to the speed, and Chhugani and colleagues reported a speed-up of their SSE version over the scalar code. Records with expensive comparisons or behind pointers fit registers badly.
