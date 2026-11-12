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
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
  - Start the dictionary with the 256 single bytes and read the text as its UTF-8 bytes.
  - Grow the current phrase while phrase plus byte is known; otherwise emit its code and learn phrase plus byte.
  - See why the decoder can rebuild the same dictionary from the codes alone, one step behind.
bounds:
  model: dictionary lookups
  best: one per input byte
  worst: 'one per input byte, n for n bytes'
---

Grow a dictionary of phrases while reading and emit the index of the longest known one.

The dictionary starts with the single bytes, codes 0 to 255, and the text is read as its UTF-8 bytes, so a letter outside ASCII such as ů is two bytes, each with a code to start from. The current phrase grows while the phrase plus the next byte is already known; when it is not, the phrase's code is emitted, phrase plus byte becomes the next code, and the next phrase starts from that byte. The decoder can rebuild the same dictionary from the codes alone, one step behind.

Codes are counted at the width the decoder needs for the next code number, at least 9 bits and at most 12 (the dictionary stops growing once its 12-bit codes are used up). The chart plots the output as a percentage of the input bits while the text is read: with repeated phrases it falls as the dictionary learns them.
