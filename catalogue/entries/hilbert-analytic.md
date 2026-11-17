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
relations:
  - type: related_to
    target: lcr-network
    reason: A circuit's phasor is the analytic signal of one steady sinusoid, the drive as the real part of V·e^(iωt); the Hilbert transform builds that rotating complex amplitude for a signal of many frequencies, its length the envelope and its turning rate the frequency.
  - type: compares_with
    target: yin-pitch
    reason: Both read a frequency from a record; the analytic signal's phase step gives it sample by sample for a single component, where YIN's difference function finds one period of a harmonic tone and is not fooled by a missing fundamental.
experiments:
  - id: cos-to-sin
    title: The transform of cos is sin
    params: { depth: 0, dev: 0 }
    observe: 'With no modulation x is a pure cosine on a whole bin; Im z is the sine a quarter-turn behind it to rounding, the phase portrait a unit circle, and the quadrature error near 1e−13.'
  - id: leakage
    title: A carrier off the bins
    params: { periodic: false }
    observe: The record ends part-way through a cycle; the FFT sees a jump at the ends, and the errors grow from rounding to leakage, the quadrature error from about 1e−13 to about 2e−2.
  - id: deep-am
    title: Almost to silence
    params: { depth: 0.95 }
    observe: The envelope dips to 0.05, yet |z| and the phase step follow it to rounding; only the phasor in the portrait shrinks towards the origin and turns on.
  - id: top-carrier
    title: The top carrier
    params: { fc: 2400 }
    observe: At 2,400 Hz the phase grows four times as fast, and every rounding error with it, still twelve orders below the signal.
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
  - id: quadrature-to-rounding-on-a-whole-bin
    statement: >-
      The Hilbert transform of e·cos φ is e·sin φ when the envelope's spectrum lies below the
      carrier's (Bedrosian), and here it does, by hundreds of hertz. So Im z − e·sin φ is the
      transform's own error, bounded by the same worst case as |z − e·e^(iφ)|, 3.9e−12: its RMS stays
      below 4.0e−12. Unlike the envelope, it sees the sign of Im z.
    readout: Quadrature error, Im z − e·sin φ (RMS)
    expect: { below: 4.0e-12 }
  - id: quadrature-at-the-top-carrier
    statement: >-
      At the 2,400 Hz carrier the same worst case is 1.27e−11, and the quadrature error stays below
      1.3e−11.
    readout: Quadrature error, Im z − e·sin φ (RMS)
    expect: { below: 1.3e-11 }
    setup:
      params: { fc: 2400 }
  - id: cos-to-sin
    statement: >-
      With no modulation, x is cos(2πfc·t + φ₀) on a whole bin and its Hilbert transform is
      sin(2πfc·t + φ₀): Im z matches it within the envelope's worst case at m = 0.6, which bounds the
      unmodulated tone too, below 4.0e−12 RMS.
    readout: Quadrature error, Im z − e·sin φ (RMS)
    expect: { below: 4.0e-12 }
    setup:
      params: { depth: 0, dev: 0 }
  - id: phase-step-to-rounding
    statement: >-
      For φ = 2πfc·t + (dev/fm)·sin 2πfm·t the phase advance over one sample Δ is exactly
      2πΔ·(fc + dev·cos(2πfm(t + Δ/2))·sin(πfmΔ)/(πfmΔ)), so the measured frequency, which reads
      that advance, matches this closed form; the true frequency fc + dev·cos 2πfm·t differs from it
      by up to π·dev·fm/fs, under 0.2 Hz at these rates. Each phase is off by at most |δz|/|z| ≤ 3.9e−12/(1 − m), so each step
      by twice that, 1.95e−11 rad, times fs/2π: the largest gap stays below 2.5e−8 Hz.
    readout: Phase-step frequency error (largest)
    expect: { below: 2.5e-8 }
  - id: phase-step-at-the-top-carrier
    statement: >-
      At 2,400 Hz the worst case 1.27e−11/(1 − m), doubled and times fs/2π, is 8.1e−8 Hz: the
      largest gap stays below 8.2e−8 Hz.
    readout: Phase-step frequency error (largest)
    expect: { below: 8.2e-8 }
    setup:
      params: { fc: 2400 }
---

The envelope and instantaneous frequency of a signal from its analytic counterpart.

The analytic signal z = x + i·H{x} keeps only positive frequencies: transform, double the positive bins, zero the negative ones, transform back. Its magnitude is the envelope, and the step of its phase from sample to sample is the instantaneous frequency.

The carrier is modulated in amplitude and in frequency at once, with every frequency a whole number of cycles in the record so the FFT sees it as periodic; the envelope and frequency recovered are compared with the modulations that made the signal. Switch off the whole-bin carrier and the record ends part-way through a cycle: the FFT sees a jump at the ends, and the envelope error grows from rounding to leakage. The phase portrait plots Re z against Im z: a phasor turning at the carrier frequency, its radius breathing with the envelope.

**Two oracles that |z| cannot replace.** The envelope checks the length of z, and a transform that kept the negative frequencies instead of the positive ones would pass it, its Im z the negative of the true one. The quadrature readout compares Im z with e·sin φ, the closed form of the signal's own modulations, and sees that sign. The phase-step readout compares the measured frequency with the exact advance of the synthesised phase over one sample: the measured frequency is a difference over a sample, so it trails the true frequency by half a sample, up to π·dev·fm/fs (under 0.2 Hz here), and against that closed form it is exact to rounding. Neither readout reads the analytic signal's own state: both take the modulations from the controls and the seeded rates that made the signal.

**Data.** The plate takes no data of a reader's: it runs on the signal engine, which has no data input yet; a reader's own recording waits on the engine's upload slice (U0, then U-signal).

