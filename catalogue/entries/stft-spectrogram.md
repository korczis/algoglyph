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
  - id: harris-1978-windows
    ref: 'Table 1: equivalent noise bandwidth of each window, in bins'
    purpose: algorithm-reference
tags:
  - stft
  - spectrogram
  - waterfall
complexity: 'O(F · M log M) for F frames of M samples'
motivation: Acoustic measurement and synthesis use it every day.
schema: algoglyph.entry/v2
relations:
  - type: related_to
    target: bound-states
    reason: A frame cannot be both short in time and narrow in frequency, the trade the oscillator's ground state makes between position and momentum; the Gaussian window alone reaches the bound Δt·Δf = 1/4π, as that state reaches Δx·Δp = ħ/2.
  - type: compares_with
    target: daubechies-dwt
    reason: Both map a signal over time and frequency; every STFT frame has one length, so every frequency gets the same bandwidth, where the wavelet's octaves are short at high frequencies and long at low ones.
experiments:
  - id: long-frames
    title: Long frames
    params: { frame: '1024' }
    observe: Bins of 7.8 Hz hold the tone in a thin line, but each frame spans 128 ms of the chirp, which sweeps 200 Hz within one frame and smears into a broad band.
  - id: short-frames
    title: Short frames
    params: { frame: '128' }
    observe: Each frame is 16 ms, so the chirp is a sharp diagonal, but bins of 62.5 Hz blur the tone into a wide stripe.
  - id: rectangular-window
    title: No window at all
    params: { window: rect }
    observe: The rectangular window has the narrowest noise bandwidth, one bin, and the worst leakage; the chirp sprays side lobes across the waterfall.
  - id: blackman-harris
    title: A four-term window
    params: { window: blackman-harris }
    observe: Side lobes 92 dB down leave a clean waterfall at the price of a noise bandwidth of two bins, so each bin collects twice the rectangular window's noise.
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
  - id: frames-over-the-default-signal
    statement: >-
      Frames of M = 256 samples at hop H = 128 fit ⌊(n − M)/H⌋ + 1 times in n = 16000 samples,
      with no padding: exactly 124 frames.
    readout: Frames
    expect: { value: 124 }
  - id: frames-over-8000-samples
    statement: Over n = 8000 samples the same frames fit ⌊7744/128⌋ + 1 = 61 times, exactly.
    readout: Frames
    expect: { value: 61 }
    setup:
      params: { len: '8000' }
  - id: frames-over-4000-samples
    statement: Over n = 4000 samples they fit ⌊3744/128⌋ + 1 = 30 times, exactly.
    readout: Frames
    expect: { value: 30 }
    setup:
      params: { len: '4000' }
  - id: frames-long-and-overlapped-over-4000-samples
    statement: >-
      Frames of 1024 samples at 75 % overlap (hop 256) fit ⌊2976/256⌋ + 1 = 12 times in 4000
      samples, exactly.
    readout: Frames
    expect: { value: 12 }
    setup:
      params: { len: '4000', frame: '1024', overlap: '0.75' }
  - id: welch-peak-on-the-tone-over-4000-samples
    statement: >-
      A quarter of the signal still holds the tone in one bin while the chirp sweeps four times as
      fast, so the Welch average peaks within half a bin of it plus the readout's rounding.
    readout: Welch average peak
    expect: { against: Welch average peak, against_number: 2, tolerance: 0.0167 }
    setup:
      params: { len: '4000' }
  - id: noise-bandwidth-hann
    statement: >-
      The noise alone, run through the same frames, reads 4σ²·ENBW/M per bin on average, the
      equivalent noise bandwidth ENBW = M·Σw²/(Σw)² of the window: for the periodic Hann window
      (0.5² + 0.5²/2)/0.5² = 1.5 bins, Harris's tabled 1.50. The mean over 124 frames and 127 bins is
      within 0.075 of it, four standard deviations over 200 seeds other than the claim's.
    readout: Noise bandwidth of the window, measured
    expect: { value: 1.5, tolerance: 0.075 }
  - id: noise-bandwidth-rectangular
    statement: >-
      Unwindowed, Σw² = Σw = M and the noise bandwidth is one bin exactly; the measured one is within
      0.05 of it, four standard deviations over the same 200 seeds.
    readout: Noise bandwidth of the window, measured
    expect: { value: 1, tolerance: 0.05 }
    setup:
      params: { window: rect }
  - id: noise-bandwidth-hamming
    statement: >-
      Hamming's (0.54² + 0.46²/2)/0.54² = 1.3628 bins, Harris's 1.36: measured within 0.07, four
      standard deviations, a band that excludes the Hann window's 1.5.
    readout: Noise bandwidth of the window, measured
    expect: { value: 1.3628, tolerance: 0.07 }
    setup:
      params: { window: hamming }
  - id: noise-bandwidth-blackman
    statement: >-
      Blackman's (0.42² + 0.5²/2 + 0.08²/2)/0.42² = 1.7268 bins, Harris's 1.73: measured within
      0.09, four standard deviations.
    readout: Noise bandwidth of the window, measured
    expect: { value: 1.7268, tolerance: 0.09 }
    setup:
      params: { window: blackman }
  - id: noise-bandwidth-blackman-harris
    statement: >-
      The four-term Blackman-Harris window's 2.0044 bins, Harris's 2.00: measured within 0.115, four
      standard deviations.
    readout: Noise bandwidth of the window, measured
    expect: { value: 2.0044, tolerance: 0.115 }
    setup:
      params: { window: blackman-harris }
---

Short windowed transforms over time, averaged by Welch's method into a waterfall.

A linear chirp sweeps over a steady tone in white noise. Each frame is windowed and transformed; its magnitudes in dB become one column of the waterfall. The peak of each frame, refined by a parabola through the neighbouring bins, follows the chirp, and the readout compares it with the chirp's true frequency at the frame's centre.

Averaging the frames' power spectra is Welch's method: the chirp's energy spreads across the band while the tone stays in one bin, and the averaged noise floor is much smoother than any single frame's. Longer frames sharpen frequency and blur time. Overlap adds frames to the average: with a Hann window, 50 % overlap lowers the variance of the averaged noise floor noticeably against no overlap, because the window's tapered ends would otherwise leave samples barely weighted; beyond that, neighbouring frames are so correlated that 75 % overlap gains little more.

**The window's bandwidth, measured.** A frame's bin does not collect noise from a band one bin wide: the window widens it to its equivalent noise bandwidth M·Σw²/(Σw)², one bin unwindowed, 1.5 for Hann, two for Blackman-Harris. The plate keeps the noise it added, runs it alone through the same frames, and reads the mean power per bin against 4σ²/M, σ² set by the SNR control: the ratio is that bandwidth, measured, and the readout shows the closed form from the window's coefficients beside it. A tone on a bin reads its amplitude whatever the window, so the wider the bandwidth the lower a tone stands above the noise floor: the frequency resolution a window buys costs it noise.

**Data.** The plate takes no data of a reader's: it runs on the signal engine, which has no data input yet; a reader's own recording waits on the engine's upload slice (U0, then U-signal).

