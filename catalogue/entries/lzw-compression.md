---
id: lzw-compression
title: LZW compression
taxonomy: strings/compression
status: live
engine: string
sources:
  - id: sedgewick-aic-1990
    ref: String Processing
tags:
  - compression
  - dictionary
complexity: "O(n) dictionary lookups for n characters"
related:
  - run-length-encoding
  - huffman-coding
---

Grow a dictionary of phrases while reading and emit the index of the longest known one.

The dictionary starts with the single bytes, codes 0 to 255. The current phrase grows while the phrase plus the next character is already known; when it is not, the phrase's code is emitted, phrase plus character becomes the next code, and the next phrase starts from that character. The decoder can rebuild the same dictionary from the codes alone, one step behind.

Codes are counted at the width the decoder needs for the next code number, at least 9 bits and at most 12 (the dictionary stops growing at 4096 entries). The chart plots the output as a percentage of the input bits while the text is read: with repeated phrases it falls as the dictionary learns them.
