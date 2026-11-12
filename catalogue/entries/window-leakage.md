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
---

A tone between bins smears across the spectrum; each window trades width for side lobes.

A tone exactly on a bin falls into one bin of the DFT; moved half a bin away it leaks into every bin, because the record no longer holds a whole number of periods. The plate slides the tone from on-bin to half-way and back, with the zero-padded transform drawn under the DFT bins so the window's main lobe and side lobes are visible.

Each window trades main-lobe width for side-lobe level: the rectangular window has the narrowest main lobe and side lobes near −13 dB; Hann about −31 dB, Hamming about −43 dB, Blackman about −58 dB and the four-term Blackman–Harris about −92 dB. The side lobe and −3 dB width shown are measured from the window's own transform. Lower the weak tone or move it closer to see when leakage buries it.
