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
claims:
  - id: default-entries-identity
    statement: >-
      At the defaults the dictionary does not fill, and every emitted code but the last learns one
      phrase past the 256 single bytes, so Dictionary entries minus Codes is 255, exactly.
    readout: Dictionary entries
    expect: { against: Codes, against_number: 1, offset: 255, tolerance: 0 }
  - id: nine-bit-dictionary-full
    statement: >-
      At 9 bits the dictionary holds at most 2^9 = 512 codes, 256 past the bytes. English prose of
      1024 characters emits 455 codes (an independent encoder's count), more than the 257 that
      learn them all, so the dictionary ends full, all 2^9 codes used, exactly.
    readout: Dictionary entries
    expect: { value: 512 }
    setup:
      params: { shape: prose, n: 1024, width: '9' }
  - id: nine-bit-output-identity
    statement: >-
      At 9 bits every code is written at 9 bits, the narrowest width and the widest the dictionary
      allows, so the output is 9 × 455 = 4095 bits for the 455 codes of that prose, exactly.
    readout: Output / input
    expect: { value: 4095 }
    setup:
      params: { shape: prose, n: 1024, width: '9' }
  - id: ten-bit-dictionary-full
    statement: >-
      At 10 bits the dictionary holds at most 1024 codes. English prose of 4096 characters emits
      1370 codes (an independent encoder's count), more than the 769 that learn the 768 codes
      past the bytes, so the dictionary ends full, all 2^10 codes used, exactly.
    readout: Dictionary entries
    expect: { value: 1024 }
    setup:
      params: { shape: prose, n: 4096, width: '10' }
  - id: twelve-bit-dictionary-full
    statement: >-
      At the article's 12 bits the dictionary holds at most 4096 codes, 3840 past the bytes.
      English prose of 16384 characters emits 3992 codes (an independent encoder's count, the
      dictionary filling at byte 15,596), so it ends full, all 2^12 codes used, exactly.
    readout: Dictionary entries
    expect: { value: 4096 }
    setup:
      params: { shape: prose, n: 16384, width: '12' }
---

Grow a dictionary of phrases while reading and emit the index of the longest known one.

The dictionary starts with the single bytes, codes 0 to 255, and the text is read as its UTF-8 bytes, so a letter outside ASCII such as ů is two bytes, each with a code to start from. The current phrase grows while the phrase plus the next byte is already known; when it is not, the phrase's code is emitted, phrase plus byte becomes the next code, and the next phrase starts from that byte. The decoder can rebuild the same dictionary from the codes alone, one step behind.

Codes are counted at the width the decoder needs for the next code number, at least 9 bits and at most the code width, 12 bits unless Code width lowers it (the dictionary stops growing once those codes are used up). English prose fills even 12-bit codes within the plate's longest text. The chart plots the output as a percentage of the input bits while the text is read: with repeated phrases it falls as the dictionary learns them.
