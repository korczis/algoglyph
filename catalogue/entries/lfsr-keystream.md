---
id: lfsr-keystream
title: Linear-feedback shift register
taxonomy: strings/cryptology
status: live
engine: string
sources:
  - id: pocorgtfo
tags:
  - lfsr
  - keystream
  - polynomials
motivation: A staple of the reverse-engineering literature.
complexity: "O(1) per keystream bit; period 2^w − 1 for a primitive feedback polynomial"
related:
  - crc-division
  - linear-congruential
---

A shift register whose feedback taps are a polynomial over GF(2), period up to 2ⁿ − 1.

The register shifts right once per step. The bit that leaves on the right is the keystream bit; the bit that enters on the left is the XOR of the tapped cells, which are the exponents of the feedback polynomial. XORing the keystream with the message bits gives the ciphertext row, and XORing again gives the message back.

The taps for each width come from primitive polynomials, so every non-zero state appears exactly once before the starting state returns: the Period readout is measured by stepping until that happens, and equals 2^w − 1. Being linear, the keystream is predictable from 2w of its bits, which is why such registers are combined non-linearly in real ciphers.
