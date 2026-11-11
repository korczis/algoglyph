---
id: crc-division
title: CRC as polynomial division
taxonomy: strings/cryptology
status: planned
engine: string
sources:
  - id: pocorgtfo
tags:
  - crc
  - checksums
  - polynomials
motivation: A staple of the reverse-engineering literature.
---

Divide the message by a generator polynomial over GF(2); the remainder is the check value.
