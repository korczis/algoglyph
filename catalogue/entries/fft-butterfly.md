---
id: fft-butterfly
title: Fast Fourier transform
taxonomy: signals/transforms
status: live
engine: signal
labs:
  - signal-transforms
sources:
  - id: sedgewick-aic-1990
    ref: Advanced Topics
tags:
  - fft
  - butterflies
  - bit reversal
complexity: 'O(N log N): N/2 butterflies in each of log2 N stages'
motivation: Acoustic measurement and synthesis use it every day.
related:
  - fourier-epicycles
  - stft-spectrogram
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  objectives:
  - Shuffle the input into bit-reversed order so that every stage combines neighbouring half-size transforms in place.
  - Pair entries 2^(s−1) apart in stage s, multiply the second by a twiddle factor and write back their sum and difference.
  - Check the result against the transform computed from its definition, and Parseval's identity from both sides.
algorithm:
  paradigm: divide-and-conquer
bounds:
  model: butterflies and real multiplies
  best: '(N/2) log2 N butterflies and 2N log2 N real multiplies, four per twiddle product'
  worst: '(N/2) log2 N butterflies and 2N log2 N real multiplies, four per twiddle product'
claims:
  - id: parseval-both-sides
    statement: >-
      Parseval's identity holds for the transform: Σ|x|² and Σ|X|²/N agree to the four decimals
      the readout shows.
    readout: 'Parseval: Σ|x|² vs Σ|X|²/N'
    expect: { against: 'Parseval: Σ|x|² vs Σ|X|²/N', against_number: 2, tolerance: 0.0001 }
  - id: agrees-with-direct-dft
    statement: >-
      The butterflies compute the transform of its definition: no bin of 32 differs from the
      direct O(N²) DFT by more than rounding, far below 10⁻⁹.
    readout: Largest difference from the direct DFT
    expect: { below: 1.0e-9 }
  - id: agrees-with-direct-dft-on-a-square
    statement: >-
      On a 64-sample square wave too, no bin differs from the direct DFT by more than rounding.
    readout: Largest difference from the direct DFT
    expect: { below: 1.0e-9 }
    setup:
      params: { n: '64', signal: square }
---

Radix-2 butterflies combine half-size transforms after a bit-reversed shuffle.

The input is first shuffled into bit-reversed order, so that every stage can combine neighbouring half-size transforms in place. Stage s pairs entries 2^(s-1) apart, multiplies the second of each pair by a twiddle factor e^(-2πik/2^s) and writes back their sum and difference: one butterfly.

The readouts count the butterflies and real multiplies actually performed (four real multiplies per twiddle product), and compare the result with the transform computed from its definition in O(N²); Parseval's identity, Σ|x|² = Σ|X|²/N, is shown from both sides. Choose Impulse to see a flat magnitude spectrum, Square to see its odd harmonics.
