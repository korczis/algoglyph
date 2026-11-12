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
  - linear-congruential
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
  - Shift the register once per step, the leaving bit the keystream and the entering bit the XOR of the taps.
  - XOR the keystream with the message bits to encrypt, and again to decrypt.
  - See a primitive feedback polynomial visit every non-zero state once, period 2^w − 1.
  misconceptions:
  - A long period is not secrecy; being linear, the keystream is predictable from 2w of its bits.
bounds:
  model: shifts and tap XORs
  best: 'one shift and t − 1 tap XORs per keystream bit, for t taps'
  worst: 'one shift and t − 1 tap XORs per keystream bit, for t taps'
  space: w bits of register
claims:
  - id: period-of-eight-bit-register
    statement: >-
      With the 8-bit register's primitive taps every non-zero state appears once before the
      starting state returns, so the measured period is exactly 2^8 − 1 = 255.
    readout: Period
    expect: { value: 255 }
  - id: period-of-five-bit-register
    statement: >-
      With the 5-bit register's primitive taps the measured period is exactly 2^5 − 1 = 31.
    readout: Period
    expect: { value: 31 }
    setup:
      params: { width: 5 }
---

A shift register whose feedback taps are a polynomial over GF(2), period up to 2ⁿ − 1.

The register shifts right once per step. The bit that leaves on the right is the keystream bit; the bit that enters on the left is the XOR of the tapped cells, which are the exponents of the feedback polynomial. XORing the keystream with the message bits gives the ciphertext row, and XORing again gives the message back.

The taps for each width come from primitive polynomials, so every non-zero state appears exactly once before the starting state returns: the Period readout is measured by stepping until that happens, and equals 2^w − 1. Being linear, the keystream is predictable from 2w of its bits, which is why such registers are combined non-linearly in real ciphers.
