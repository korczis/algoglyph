---
id: stft-spectrogram
title: Spectrogram
taxonomy: signals/transforms
status: live
engine: signal
labs:
  - signal-transforms
sources:
  - id: practice-signals
tags:
  - stft
  - spectrogram
  - waterfall
complexity: 'O(F · M log M) for F frames of M samples'
motivation: Acoustic measurement and synthesis use it every day.
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites:
  - fft-butterfly
  - window-leakage
  objectives:
  - Window and transform each frame, and stack the frames' magnitudes in dB into a waterfall.
  - Follow the chirp by each frame's peak, refined by a parabola through the neighbouring bins.
  - Average the frames' power spectra by Welch's method, and see longer frames sharpen frequency and blur time.
  misconceptions:
  - More overlap is not always better; beyond 50 % with a Hann window the frames are so correlated that 75 % gains little more.
algorithm:
  paradigm: transform
bounds:
  model: frames and butterflies
  worst: '⌊(n − M)/H⌋ + 1 frames of M samples at hop H over n samples, (M/2) log2 M butterflies each: O(F · M log M)'
claims:
  - id: welch-peak-on-the-tone
    statement: >-
      The tone stays in one bin while the chirp spreads, so the Welch average peaks at the bin
      nearest the tone: within half a bin (15.625 Hz at 256 samples) plus the readout's rounding.
    readout: Welch average peak
    expect: { against: Welch average peak, against_number: 2, tolerance: 0.0167 }
---

Short windowed transforms over time, averaged by Welch's method into a waterfall.

A linear chirp sweeps over a steady tone in white noise. Each frame is windowed and transformed; its magnitudes in dB become one column of the waterfall. The peak of each frame, refined by a parabola through the neighbouring bins, follows the chirp, and the readout compares it with the chirp's true frequency at the frame's centre.

Averaging the frames' power spectra is Welch's method: the chirp's energy spreads across the band while the tone stays in one bin, and the averaged noise floor is much smoother than any single frame's. Longer frames sharpen frequency and blur time. Overlap adds frames to the average: with a Hann window, 50 % overlap lowers the variance of the averaged noise floor noticeably against no overlap, because the window's tapered ends would otherwise leave samples barely weighted; beyond that, neighbouring frames are so correlated that 75 % overlap gains little more.
