---
id: fourier-epicycles
title: Epicycle Engine
taxonomy: signals/transforms
status: live
engine: custom
sources:
  - id: smith-dsp-guide
    ref: 'Chapter 31: The Complex Fourier Transform'
tags:
  - Fourier
  - complex numbers
  - signal processing
complexity: O(N²) DFT once, O(terms) per frame
schema: algoglyph.entry/v2
pedagogy:
  difficulty: introductory
  objectives:
  - Read the 256 samples of a closed curve as complex numbers and their DFT as circles of radius, phase and speed.
  - Chain the circles tip to tail, largest first, and watch the tip trace the curve.
  - See corners melt first as terms are taken away, because only high frequencies turn that sharply.
algorithm:
  paradigm: transform
---

A chain of rotating circles, one per Fourier coefficient, redraws a closed curve. Take terms away and the corners are the first thing to melt.

The curve is sampled at 256 points read as complex numbers x + iy. Their discrete Fourier transform gives 256 coefficients, each a circle with a radius (amplitude), a starting angle (phase) and a speed (frequency, positive or negative turns per period).

Chained tip to tail and ordered from the largest circle down, the circles trace the curve. With fewer terms the tip follows a smoothed version; the readout measures the RMS distance between that approximation and the samples, relative to the curve's size.

Corners are where the direction of travel jumps, and only high frequencies can turn that sharply. With the same number of terms the square is approximated worse than the smooth trefoil, and the readout shows it: compare both at 12 terms.
