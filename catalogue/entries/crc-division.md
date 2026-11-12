---
id: crc-division
title: CRC as polynomial division
taxonomy: strings/cryptology
status: live
engine: string
sources:
  - id: pocorgtfo
tags:
  - crc
  - checksums
  - polynomials
motivation: A staple of the reverse-engineering literature.
complexity: "O(n w) bit operations for n message bits and a w-bit generator"
related:
  - lfsr-keystream
  - hash-avalanche
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
  - Divide the message bits followed by w zero bits by the generator x^w plus the model's polynomial over GF(2).
  - XOR the generator in wherever the leading bit is 1, and move on where it is 0.
  - Check the published check values of CRC-8, CRC-16/CCITT-FALSE, CRC-24/OpenPGP and CRC-32 on 123456789.
bounds:
  model: division steps and bit XORs, for n message bits and a w-bit generator
  worst: 'n division steps and at most (w + 1) n bit XORs, the generator XORed in wherever the leading bit is 1: O(n w)'
---

Divide the message by a generator polynomial over GF(2); the remainder is the check value.

The dividend row is the message bits followed by w zero bits, with the model's initial register XORed into the first w bits (a reflecting model, such as CRC-32, takes each byte least significant bit first). Wherever the leading bit is 1 the generator, x^w plus the model's polynomial, is XORed in beneath it; a leading 0 just moves on. The last w bits are the remainder, which the model may reflect and XOR with a final constant.

Choose the check input 123456789: CRC-8 gives 0xF4, CRC-16/CCITT-FALSE 0x29B1, CRC-24/OpenPGP 0x21CF02 and CRC-32 0xCBF43926, the published check values of those models.
