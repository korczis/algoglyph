---
id: noise-colours
title: White, pink and brown noise
taxonomy: signals/synthesis
status: live
engine: signal
sources:
  - id: practice-signals
tags:
  - noise
  - 1/f
  - filters
complexity: 'O(n) to generate; O(n log M) for the Welch estimate'
motivation: Acoustic measurement and synthesis use it every day.
related:
  - biquad-filters
relations:
  - { type: uses, target: least-squares, reason: "The slopes are fitted by least squares to the Welch-averaged power." }
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites:
  - stft-spectrogram
  objectives:
  - Tell white, pink and brown noise apart by power falling 0, 3 and 6 dB per octave.
  - Make pink noise by the Voss–McCartney algorithm and brown noise by a leaky integrator.
  - Fit the slopes by least squares to Welch-averaged power in third-octave bands.
---

Noise whose power falls by 0, 3 and 6 dB per octave, and the filters that colour it.

White noise has the same power in every hertz, so its spectrum is flat. Pink noise has the same power in every octave, falling by 10·log10 2 ≈ 3 dB per octave; here it is made by the Voss–McCartney algorithm, which sums held random values refreshed at rates an octave apart. Brown noise is integrated white noise and falls by 6 dB per octave; a leaky integrator keeps it bounded.

The slopes are fitted by least squares to the Welch-averaged power in third-octave bands between the two marks, and settle as more frames are averaged. Fewer Voss–McCartney rows cover fewer octaves, and the pink spectrum flattens below the slowest row's rate.
