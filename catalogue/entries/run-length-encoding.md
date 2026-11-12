---
id: run-length-encoding
title: Run-length encoding
taxonomy: strings/compression
status: live
engine: string
sources:
  - id: sedgewick-aic-1990
    ref: String Processing
tags:
  - compression
  - runs
complexity: "O(n) for n symbols"
related:
  - lzw-compression
  - huffman-coding
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  objectives:
  - Grow a run while the next symbol equals the current one, and emit it as a count and the symbol.
  - Split a run longer than the count can hold into pieces, 255 for a count of one byte.
  - See scanline runs shrink and English prose, with runs mostly of length one, grow to about twice the input.
bounds:
  model: symbol comparisons
  worst: 'n − 1 for n symbols: each symbol after the first is compared once with the run it may extend'
claims:
  - id: default-one-pair-per-run
    statement: >-
      At the defaults no scanline run reaches 255 symbols (the longest of the seeded text is 40),
      so each of its 10 maximal runs, counted by a regular expression, is one pair: 10 pairs.
    readout: Pairs emitted
    expect: { value: 10 }
  - id: mean-400-splits-runs
    statement: >-
      At a mean run of 400 over n = 1024 the text's maximal runs are 551 and 473 symbols (a
      regular expression's reading), so the pairs are ⌈551 / 255⌉ + ⌈473 / 255⌉ = 3 + 2 = 5, more
      than the 2 runs: the split is drawn.
    readout: Pairs emitted
    expect: { value: 5 }
    setup:
      params: { n: 1024, meanRun: 400 }
  - id: mean-400-comparisons-identity
    statement: >-
      Each symbol after the first is compared once, except where a pair stops at the 255 limit
      before the text's end: the 551-run is cut twice and the 473-run once, so n − 1 − 3 = 1020
      comparisons, exactly.
    readout: Symbol comparisons
    expect: { value: 1020 }
    setup:
      params: { n: 1024, meanRun: 400 }
  - id: count-4-bits-pairs
    statement: >-
      With a 4-bit count a pair holds at most 15 symbols: the default text's 10 runs include one
      of 40 and one of 19, so the pairs are 8 + ⌈40 / 15⌉ + ⌈19 / 15⌉ = 8 + 3 + 2 = 13.
    readout: Pairs emitted
    expect: { value: 13 }
    setup:
      params: { countBits: '4' }
  - id: count-2-bits-output
    statement: >-
      With a 2-bit count a pair holds at most 3 symbols, so the default text's runs make Σ ⌈L / 3⌉
      = 44 pairs (from the regular expression's runs) of 2 + 8 bits: ⌈44 × 10 / 8⌉ = 55 bytes out.
    readout: Output / input
    expect: { value: 55 }
    setup:
      params: { countBits: '2' }
---

Replace each run of a repeated symbol with the symbol and a count.

The input is read once. While the next symbol equals the current one the run grows; at the first different symbol the run is emitted as a count and the symbol. A count occupies one byte, so a run longer than 255 is emitted in pieces, and the output costs two bytes per pair. Count width narrows the count to 4 or 2 bits (runs of 15 or 3), and Mean run lengthens the scanline runs until most of them exceed 255.

The chart compares bytes read with bytes written. Scanline runs halve or better; switch the input to English prose, where runs are mostly of length one, and the output grows to about twice the input.
