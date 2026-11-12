---
id: daubechies-dwt
title: Daubechies wavelet transform
taxonomy: signals/transforms
status: live
engine: signal
labs:
  - signal-transforms
sources:
  - id: practice-decisions
tags:
  - wavelets
  - multi-scale
  - dwt
complexity: 'O(N · L) for a filter of length L; each level halves the work'
motivation: Decisions made under uncertainty, and checked afterwards, rest on it.
---

A signal split into detail and approximation, octave by octave.

Each level convolves the approximation with a low-pass scaling filter h and a high-pass wavelet filter g_k = (−1)^k h_(L−1−k), keeping every second output: half the samples become the next, coarser approximation and half become that octave's details. The Daubechies filters with p vanishing moments are orthonormal, so the inverse is the transpose and the reconstruction is exact to rounding.

Smooth stretches of the signal leave tiny detail coefficients and the step and the burst leave a few large ones, so keeping only the largest coefficients and rebuilding loses little: the compression SNR is measured from the rebuilt signal. Haar has one vanishing moment and shows blocky approximations; D8 has four and approximates smooth parts with far fewer coefficients.
