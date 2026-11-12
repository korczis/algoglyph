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
---

Replace each run of a repeated symbol with the symbol and a count.

The input is read once. While the next symbol equals the current one the run grows; at the first different symbol the run is emitted as a count and the symbol. A count occupies one byte, so a run longer than 255 is emitted in pieces, and the output costs two bytes per pair.

The chart compares bytes read with bytes written. Scanline runs halve or better; switch the input to English prose, where runs are mostly of length one, and the output grows to about twice the input.
