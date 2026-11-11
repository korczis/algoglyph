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
---

Short windowed transforms over time, averaged by Welch's method into a waterfall.

A linear chirp sweeps over a steady tone in white noise. Each frame is windowed and transformed; its magnitudes in dB become one column of the waterfall. The peak of each frame, refined by a parabola through the neighbouring bins, follows the chirp, and the readout compares it with the chirp's true frequency at the frame's centre.

Averaging the frames' power spectra is Welch's method: the chirp's energy spreads across the band while the tone stays in one bin, and the averaged noise floor is much smoother than any single frame's. Longer frames sharpen frequency and blur time. Overlap adds frames to the average: with a Hann window, 50 % overlap lowers the variance of the averaged noise floor noticeably against no overlap, because the window's tapered ends would otherwise leave samples barely weighted; beyond that, neighbouring frames are so correlated that 75 % overlap gains little more.
