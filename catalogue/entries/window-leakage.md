---
id: window-leakage
title: Windows and spectral leakage
taxonomy: signals/transforms
status: live
engine: signal
sources:
  - id: practice-signals
tags:
  - windows
  - leakage
  - hann
  - blackman
complexity: 'O(N log N) per spectrum'
motivation: Acoustic measurement and synthesis use it every day.
related:
  - stft-spectrogram
schema: algoglyph.entry/v2
pedagogy:
  difficulty: intermediate
  prerequisites:
  - fft-butterfly
  objectives:
  - See a tone on a bin fall into one bin, and a tone half a bin away leak into every bin.
  - Trade main-lobe width against side-lobe level across the rectangular, Hann, Hamming, Blackman and Blackman–Harris windows.
  - Lower the weak tone or move it closer and see when leakage buries it.
claims:
  - id: rectangular-side-lobe
    statement: >-
      The rectangular window's highest side lobe, measured from its own zero-padded transform,
      lies within 1 dB of the note's −13 dB (rounded to the decibel).
    readout: Highest side lobe (measured)
    expect: { value: -13, tolerance: 1 }
    setup:
      params: { window: rect }
  - id: hann-side-lobe
    statement: The Hann window's highest side lobe lies within 1 dB of the note's −31 dB.
    readout: Highest side lobe (measured)
    expect: { value: -31, tolerance: 1 }
  - id: hamming-side-lobe
    statement: The Hamming window's highest side lobe lies within 1 dB of the note's −43 dB.
    readout: Highest side lobe (measured)
    expect: { value: -43, tolerance: 1 }
    setup:
      params: { window: hamming }
  - id: blackman-side-lobe
    statement: The Blackman window's highest side lobe lies within 1 dB of the note's −58 dB.
    readout: Highest side lobe (measured)
    expect: { value: -58, tolerance: 1 }
    setup:
      params: { window: blackman }
  - id: blackman-harris-side-lobe
    statement: >-
      The four-term Blackman–Harris window's highest side lobe lies within 1 dB of the note's
      −92 dB.
    readout: Highest side lobe (measured)
    expect: { value: -92, tolerance: 1 }
    setup:
      params: { window: blackman-harris }
  - id: hann-side-lobe-at-128
    statement: >-
      At N = 128 the Hann window's highest side lobe is Harris's −31.47 dB within 0.2 dB: the
      16× zero-padded grid misses a lobe's top by at most 1/32 bin (under 0.03 dB here), the
      finite-N Dirichlet kernel departs from the table's large-N value as 1/N², and the readout
      and the table are rounded to 0.1 and 0.01 dB.
    readout: Highest side lobe (measured)
    expect: { value: -31.47, tolerance: 0.2 }
    setup:
      params: { n: '128' }
  - id: hamming-side-lobe-at-128
    statement: >-
      At N = 128 the Hamming window's highest side lobe is Harris's −42.68 dB within the same
      0.2 dB; its finite-N departure, 0.23 dB at N = 64, falls as 1/N² to 0.06 dB.
    readout: Highest side lobe (measured)
    expect: { value: -42.68, tolerance: 0.2 }
    setup:
      params: { n: '128', window: hamming }
  - id: rectangular-side-lobe-at-128
    statement: At N = 128 the rectangular window's highest side lobe is −13.26 dB within the same 0.2 dB.
    readout: Highest side lobe (measured)
    expect: { value: -13.26, tolerance: 0.2 }
    setup:
      params: { n: '128', window: rect }
  - id: hann-width-at-128
    statement: >-
      At N = 128 the Hann main lobe is Harris's 1.44 bins wide at −3 dB, within 0.015 bin: linear
      interpolation on the 1/16-bin grid errs by under 0.002 bin, and the readout and the table
      are rounded to 0.01 bin.
    readout: Main lobe −3 dB width
    expect: { value: 1.44, tolerance: 0.015 }
    setup:
      params: { n: '128' }
  - id: blackman-harris-width-at-128
    statement: At N = 128 the Blackman–Harris main lobe is Harris's 1.90 bins wide, within the same 0.015 bin.
    readout: Main lobe −3 dB width
    expect: { value: 1.9, tolerance: 0.015 }
    setup:
      params: { n: '128', window: blackman-harris }
---

A tone between bins smears across the spectrum; each window trades width for side lobes.

A tone exactly on a bin falls into one bin of the DFT; moved half a bin away it leaks into every bin, because the record no longer holds a whole number of periods. The plate slides the tone from on-bin to half-way and back, with the zero-padded transform drawn under the DFT bins so the window's main lobe and side lobes are visible.

Each window trades main-lobe width for side-lobe level: the rectangular window has the narrowest main lobe and side lobes near −13 dB; Hann about −31 dB, Hamming about −43 dB, Blackman about −58 dB and the four-term Blackman–Harris about −92 dB. The side lobe and −3 dB width shown are measured from the window's own transform; at 128 samples instead of 64 they sit closer to the published large-N values, Hamming's most of all. Lower the weak tone or move it closer to see when leakage buries it.
