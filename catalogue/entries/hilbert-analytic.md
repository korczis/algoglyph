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
---

The envelope and instantaneous frequency of a signal from its analytic counterpart.

The analytic signal z = x + i·H{x} keeps only positive frequencies: transform, double the positive bins, zero the negative ones, transform back. Its magnitude is the envelope, and the step of its phase from sample to sample is the instantaneous frequency.

The carrier is modulated in amplitude and in frequency at once, with every frequency a whole number of cycles in the record so the FFT sees it as periodic; the envelope and frequency recovered are compared with the modulations that made the signal. The phase portrait plots Re z against Im z: a phasor turning at the carrier frequency, its radius breathing with the envelope.
