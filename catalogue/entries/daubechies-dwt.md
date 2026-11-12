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
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  objectives:
  - Convolve the approximation with the scaling filter h and the wavelet filter g, keeping every second output.
  - See why the Daubechies filters' orthonormality makes the inverse the transpose and the reconstruction exact to rounding.
  - Keep only the largest coefficients and rebuild, and compare Haar's blocky approximations with D8's.
algorithm:
  paradigm: transform
bounds:
  model: real multiplies of the analysis filter bank
  worst: 'N·L at the first level for a filter of length L, half that at each next: 2NL(1 − 2^−J) for J levels, below 2NL'
claims:
  - id: reconstruction-exact-to-rounding
    statement: >-
      The filters are orthonormal, so rebuilding from every coefficient reproduces the signal to
      rounding: no sample is off by 10⁻⁹.
    readout: Perfect reconstruction, largest error
    expect: { below: 1.0e-9 }
  - id: reconstruction-rounding-bound-at-128
    statement: >-
      Each level is orthogonal, and its outputs are sums of at most 2L products, each off by at
      most 2L·u (u = 2⁻⁵³) times the same sum in absolute value, whose matrix has norm at most
      ‖h‖₁ ≤ √L. Five levels there and five back with D4 (L = 4) on 128 samples of a signal never
      above 2.4 add at most 2·5·2·4·u·√4·√128·2.4 = 4.82·10⁻¹³ to any sample.
    readout: Perfect reconstruction, largest error
    expect: { below: 4.82e-13 }
    setup:
      params: { n: '128' }
  - id: reconstruction-rounding-bound-at-256
    statement: >-
      The same bound on 256 samples is 2·5·2·4·u·√4·√256·2.4 = 6.82·10⁻¹³.
    readout: Perfect reconstruction, largest error
    expect: { below: 6.82e-13 }
    setup:
      params: { n: '256' }
  - id: multiplies-at-128
    statement: >-
      The run meters the analysis and two rebuilds (the full one and the compressed one), each n·L
      multiplies at the first level and half that at each next, 2nL(1 − 2⁻ᴶ) apiece: on 128
      samples with D4 and five levels, 6·128·4·(1 − 1/32) = 2976 multiplies exactly.
    readout: Real multiplies
    expect: { value: 2976 }
    setup:
      params: { n: '128' }
  - id: multiplies-at-256
    statement: >-
      On 256 samples the same count is 6·256·4·(1 − 1/32) = 5952 multiplies exactly.
    readout: Real multiplies
    expect: { value: 5952 }
    setup:
      params: { n: '256' }
---

A signal split into detail and approximation, octave by octave.

Each level convolves the approximation with a low-pass scaling filter h and a high-pass wavelet filter g_k = (−1)^k h_(L−1−k), keeping every second output: half the samples become the next, coarser approximation and half become that octave's details. The Daubechies filters with p vanishing moments are orthonormal, so the inverse is the transpose and the reconstruction is exact to rounding.

Smooth stretches of the signal leave tiny detail coefficients and the step and the burst leave a few large ones, so keeping only the largest coefficients and rebuilding loses little: the compression SNR is measured from the rebuilt signal. Haar has one vanishing moment and shows blocky approximations; D8 has four and approximates smooth parts with far fewer coefficients.
