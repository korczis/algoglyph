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
---

Divide the message by a generator polynomial over GF(2); the remainder is the check value.

The dividend row is the message bits followed by w zero bits, with the model's initial register XORed into the first w bits (a reflecting model, such as CRC-32, takes each byte least significant bit first). Wherever the leading bit is 1 the generator, x^w plus the model's polynomial, is XORed in beneath it; a leading 0 just moves on. The last w bits are the remainder, which the model may reflect and XOR with a final constant.

Choose the check input 123456789: CRC-8 gives 0xF4, CRC-16/CCITT-FALSE 0x29B1, CRC-24/OpenPGP 0x21CF02 and CRC-32 0xCBF43926, the published check values of those models.
