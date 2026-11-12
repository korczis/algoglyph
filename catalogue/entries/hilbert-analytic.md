---
id: hilbert-analytic
title: Hilbert transform and the analytic signal
taxonomy: signals/transforms
status: live
engine: signal
labs:
  - signal-transforms
sources:
  - id: practice-signals
tags:
  - hilbert
  - envelope
  - instantaneous frequency
complexity: 'O(N log N): one forward and one inverse FFT'
motivation: Acoustic measurement and synthesis use it every day.
related:
  - fm-synthesis
schema: algoglyph.entry/v2
pedagogy:
  difficulty: advanced
  prerequisites:
  - fft-butterfly
  objectives:
  - Build the analytic signal by transforming, doubling the positive bins, zeroing the negative ones and transforming back.
  - Read the envelope as its magnitude and the instantaneous frequency as the step of its phase.
  - See why every frequency is a whole number of cycles in the record, so the FFT sees it as periodic.
algorithm:
  paradigm: transform
bounds:
  model: butterflies
  best: 'N log2 N for N samples, padded to a power of two: one forward and one inverse FFT'
  worst: 'N log2 N for N samples, padded to a power of two: one forward and one inverse FFT'
claims:
  - id: envelope-to-rounding-on-a-whole-bin
    statement: >-
      With the carrier on a whole bin the record is periodic and |z| is the envelope to rounding:
      the RMS error stays below 4.0e-12. The bound is the worst case of u = 2^−53 on every
      operation: about 15,000 u on a phase of up to 2,000 rad at 600 Hz, times the peak envelope
      1 + m = 1.6 and the analytic map's gain √2, plus two 4,096-point FFTs (Higham's
      12 η each, η ≈ 13.7 u), 3.9e-12 in all.
    readout: Envelope RMS error
    expect: { below: 4.0e-12 }
  - id: envelope-to-rounding-at-the-top-carrier
    statement: >-
      At the top carrier, 2,400 Hz snapped to 2,400.39 Hz, the phase reaches 7,800 rad and the same
      worst case is about 50,000 u on the phase, 1.27e-11 in all: the error stays below 1.3e-11,
      growing with the carrier because the phase's rounding, not the FFT, dominates.
    readout: Envelope RMS error
    expect: { below: 1.3e-11 }
    setup:
      params: { fc: 2400 }
---

The envelope and instantaneous frequency of a signal from its analytic counterpart.

The analytic signal z = x + i·H{x} keeps only positive frequencies: transform, double the positive bins, zero the negative ones, transform back. Its magnitude is the envelope, and the step of its phase from sample to sample is the instantaneous frequency.

The carrier is modulated in amplitude and in frequency at once, with every frequency a whole number of cycles in the record so the FFT sees it as periodic; the envelope and frequency recovered are compared with the modulations that made the signal. Switch off the whole-bin carrier and the record ends part-way through a cycle: the FFT sees a jump at the ends, and the envelope error grows from rounding to leakage. The phase portrait plots Re z against Im z: a phasor turning at the carrier frequency, its radius breathing with the envelope.
