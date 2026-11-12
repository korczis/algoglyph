---
id: simd-sorting-network
title: SIMD sorting network
taxonomy: sorting/networks
status: live
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
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites: [bitonic-sort]
  objectives:
  - 'Read the Rounds readout at 512 keys: 4,005 vector instructions on every input, 160 in the in-register sorts of the 32 blocks of 16 keys and five for each of the 769 merges of two registers.'
  - 'Read the Lanes readout: 4, one per lane of the modelled vector register.'
  - 'Explain why one min and max instruction over two registers performs four comparators at once.'
  misconceptions:
  - 'Vectorising a sort reduces its comparisons; on Random permutation at 512 keys the plate''s network makes 10,506, more than twice n lg n = 4,608, and gains by running four of them in each instruction.'
algorithm:
  properties:
    stable: false
    in_place: false
bounds:
  model: 'comparisons (between real keys; a padded +∞ costs none), array writes (the real keys written back after every step, one per key that moved) and rounds (vector instructions: a min and max over four lanes, or one half-cleaner level inside a register)'
  average: 'four lanes, and the same vector instructions on every input of n keys: 5N/16 + 5((k − 3)N/4 + 1) for N = 2^k ≥ 16, 4,005 at 512 keys'
claims:
  - id: vector-instructions
    statement: >-
      On Random permutation at 512 keys the SIMD network takes 4,005 vector instructions, 5N/16 + 5((k − 3)N/4 + 1) for N = 2^9: five for the in-register sort of each block of 16 keys and five for each merge of two registers.
    readout: Rounds
    expect: { value: 4005 }
    setup:
      params: { shape: random, n: 512, speed: 2000 }
---

A mergesort whose comparators are vector instructions: sort small blocks inside registers with a fixed network of min and max operations, transpose them into sorted runs, and merge runs with a bitonic merge network executed register against register.

A comparator is just a minimum and a maximum, and a vector unit computes the minimum or maximum of every lane of a register at once, so one pair of instructions performs as many comparators as the register has lanes. A sorting network has no data-dependent branches, which is exactly what such instructions need; the bitonic merge fits especially well, because each of its layers compares keys a fixed distance apart, a lane-wise comparison of two registers followed by a fixed shuffle.

The plate models four-lane registers, one lane per vector lane: blocks of sixteen keys are sorted by the optimal four-input network across registers and transposed, then runs of four, eight, sixteen and onwards are merged by the vectorised bitonic kernel. It counts total work and runs the lanes one after another, and each round it counts is one vector instruction: a min and max over all four lanes, or one half-cleaner level inside a register. Inputs are padded to a multiple of sixteen as vector code pads. Start with Random permutation at n = 64 and watch the in-register phase finish before the first merge.

The network changes only the constant, not the order: the whole sort makes on the order of n log n comparisons and needs linear extra space, and the min and max network does not preserve the order of equal keys. It pays off for large arrays of primitive keys on processors with wide vector registers; Inoue and colleagues found aligned memory access essential to the speed, and Chhugani and colleagues reported a speed-up of their SSE version over the scalar code. Records with expensive comparisons or behind pointers fit registers badly.
