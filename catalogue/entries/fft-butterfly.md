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
---

Radix-2 butterflies combine half-size transforms after a bit-reversed shuffle.

The input is first shuffled into bit-reversed order, so that every stage can combine neighbouring half-size transforms in place. Stage s pairs entries 2^(s-1) apart, multiplies the second of each pair by a twiddle factor e^(-2πik/2^s) and writes back their sum and difference: one butterfly.

The readouts count the butterflies and real multiplies actually performed (four real multiplies per twiddle product), and compare the result with the transform computed from its definition in O(N²); Parseval's identity, Σ|x|² = Σ|X|²/N, is shown from both sides. Choose Impulse to see a flat magnitude spectrum, Square to see its odd harmonics.
