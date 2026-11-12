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
  - Read the samples of a closed curve (256 by default) as complex numbers and their DFT as circles of radius, phase and speed.
  - Chain the circles tip to tail, largest first, and watch the tip trace the curve.
  - See corners melt first as terms are taken away, because only high frequencies turn that sharply.
algorithm:
  paradigm: transform
claims:
  - id: heart-three-terms-at-64-samples
    statement: >-
      The heart is a trigonometric polynomial of degree 4: x = (12 sin a − 4 sin 3a)/17 and y
      four cosines, so z = x + iy has eight circles, of radii 25, 6, 5, 5, 2, 1, 1, 1 in 34ths,
      with Σ r² = 718, and 64 samples resolve them without aliasing. The plate's DFT divides by N,
      so Parseval makes the RMS error of the largest three √(5² + 2² + 1 + 1 + 1) and the curve's
      size √718: 100·√(32/718) = 21.11 %, within half the readout's last digit.
    readout: RMS error / size
    expect: { value: 21.11, tolerance: 0.005 }
    setup:
      params: { shape: heart, terms: 3, samples: '64' }
  - id: heart-two-terms-at-128-samples
    statement: >-
      At 128 samples the heart's eight circles are the same, and the largest two leave
      √(5² + 5² + 2² + 1 + 1 + 1) of √718 out: 100·√(57/718) = 28.18 %, within half the last digit.
    readout: RMS error / size
    expect: { value: 28.18, tolerance: 0.005 }
    setup:
      params: { shape: heart, terms: 2, samples: '128' }
  - id: heart-exact-with-eight-terms-at-64-samples
    statement: >-
      All eight of the heart's circles leave nothing out, so even from 64 samples eight terms
      redraw it to rounding: 0.00 %.
    readout: RMS error / size
    expect: { value: 0, tolerance: 0.005 }
    setup:
      params: { shape: heart, terms: 8, samples: '64' }
---

A chain of rotating circles, one per Fourier coefficient, redraws a closed curve. Take terms away and the corners are the first thing to melt.

The curve is sampled at 256 points by default (64 or 128 with the control), read as complex numbers x + iy. Their discrete Fourier transform gives as many coefficients, each a circle with a radius (amplitude), a starting angle (phase) and a speed (frequency, positive or negative turns per period).

Chained tip to tail and ordered from the largest circle down, the circles trace the curve. With fewer terms the tip follows a smoothed version; the readout measures the RMS distance between that approximation and the samples, relative to the curve's size.

Corners are where the direction of travel jumps, and only high frequencies can turn that sharply. With the same number of terms the square is approximated worse than the smooth trefoil, and the readout shows it: compare both at 12 terms.
