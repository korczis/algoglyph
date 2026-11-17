---
id: fourier-epicycles
title: Epicycle Engine
taxonomy: signals/transforms
status: live
engine: custom
sources:
  - id: smith-dsp-guide
    ref: 'Chapter 31: The Complex Fourier Transform'
  - id: feynman-lectures
    ref: 'Vol. I, ch. 50 (Harmonics: a periodic motion as a sum of sines and cosines)'
    purpose: further-reading
tags:
  - Fourier
  - complex numbers
  - signal processing
complexity: O(N²) DFT once, O(terms) per frame
motivation: A closed curve is a sum of circles, and a known curve says in closed form how large each one is; the chain shows the series, and the readouts check it.
relations:
  - type: related_to
    target: kepler-orbits
    reason: Ptolemy's deferent carrying an epicycle is the first two circles of this chain; Kepler replaced them by one ellipse under an inverse-square force, which traced in time is itself a series of circles whose radii fall with the eccentricity.
  - type: compares_with
    target: daubechies-dwt
    reason: Both rebuild a signal from its largest coefficients; a circle spans the whole period, so a corner costs terms everywhere along the curve, where a wavelet is local and a step costs a few coefficients near it.
experiments:
  - id: three-circles
    title: The trefoil is three circles
    params: { shape: trefoil, terms: 3 }
    observe: 'Three circles redraw the trefoil exactly (0.00 %): r = 0.35 + 0.65 cos²(3a) is 0.675 at one turn per period and 0.1625 at seven forward and five back.'
  - id: square-corners
    title: Corners cost circles
    params: { shape: square, terms: 12 }
    observe: The square's circles turn at 1, −3, 5, −7, … turns per period and shrink about as 1/k²; the second is close to a ninth of the first, and twelve leave the corners rounded.
  - id: deferent-and-epicycle
    title: A deferent and an epicycle
    params: { shape: heart, terms: 2 }
    observe: Two circles, the larger carrying the smaller, as in Ptolemy's model of a planet; one turn and three turns per period, they leave 28 % of the heart out, and its cleft and point come only with the smaller circles.
  - id: few-samples
    title: Every sample, not the curve between
    params: { shape: square, samples: '64', terms: 64 }
    observe: All 64 circles pass through every sample (0.00 %), yet between samples the tip ripples near the corners; the chain interpolates the samples, it does not know the square's straight sides.
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
  - id: heart-second-circle
    statement: >-
      The heart's two largest circles have radii 25 and 6 in 34ths, so the second is 6/25 = 0.24 of
      the first at any sample count that resolves them, within half the readout's last digit.
    readout: second circle / largest
    expect: { value: 0.24, tolerance: 0.000001 }
  - id: trefoil-exact-with-three-circles
    statement: >-
      The trefoil r = 0.35 + 0.65 cos²(3a) is, since cos²(3a) = (1 + cos 6a)/2, the circle 0.675 e^(ia)
      plus 0.1625 e^(7ia) and 0.1625 e^(−5ia): three circles, so three terms redraw it to rounding,
      0.00 %.
    readout: RMS error / size
    expect: { value: 0, tolerance: 0.005 }
    setup:
      params: { shape: trefoil, terms: 3 }
  - id: trefoil-one-circle
    statement: >-
      The trefoil's largest circle alone leaves the two of radius 0.1625 out, so by Parseval the
      error is 100·√(2·0.1625²/(0.675² + 2·0.1625²)) = 32.229 % of the size, within half a digit.
    readout: RMS error / size
    expect: { value: 32.229, tolerance: 0.005 }
    setup:
      params: { shape: trefoil, terms: 1 }
  - id: trefoil-second-circle
    statement: >-
      The trefoil's second circle is 0.1625/0.675 = 13/54 = 0.240741 of its first; the two second
      circles tie, so the readout's frequency may be 7 or −5, and only the ratio is read.
    readout: second circle / largest
    expect: { value: 0.240741, tolerance: 0.000001 }
    setup:
      params: { shape: trefoil }
  - id: square-second-circle
    statement: >-
      Traced at constant speed the square's velocity jumps only at its four corners, so the second
      difference of its N samples is zero elsewhere and its transform is X_k ∝ 1/sin²(πk/N) on
      k ≡ 1 (mod 4), 0 on every other k. The second circle turns at −3, at
      sin²(π/256)/sin²(3π/256) = 0.111156 of the first: not the continuous square's 1/9 = 0.111111,
      which the 1e−6 band excludes.
    readout: second circle / largest
    expect: { value: 0.111156, tolerance: 0.000001 }
    setup:
      params: { shape: square }
  - id: square-second-circle-at-64-samples
    statement: >-
      From 64 samples the same closed form gives sin²(π/64)/sin²(3π/64) = 0.111828, further from 1/9
      as the samples thin.
    readout: second circle / largest
    expect: { value: 0.111828, tolerance: 0.000001 }
    setup:
      params: { shape: square, samples: '64' }
  - id: square-one-circle
    statement: >-
      The square's largest circle alone leaves out every other 1/sin⁴(πk/N) of the power: by
      Parseval over k ≡ 1 (mod 4) at 256 samples, 12.036 % of the size, within half a digit.
    readout: RMS error / size
    expect: { value: 12.036, tolerance: 0.005 }
    setup:
      params: { shape: square, terms: 1 }
---

A chain of rotating circles, one per Fourier coefficient, redraws a closed curve. Take terms away and the corners are the first thing to melt.

The curve is sampled at 256 points by default (64 or 128 with the control), read as complex numbers x + iy. Their discrete Fourier transform gives as many coefficients, each a circle with a radius (amplitude), a starting angle (phase) and a speed (frequency, positive or negative turns per period).

Chained tip to tail and ordered from the largest circle down, the circles trace the curve. With fewer terms the tip follows a smoothed version; the readout measures the RMS distance between that approximation and the samples, relative to the curve's size.

Corners are where the direction of travel jumps, and only high frequencies can turn that sharply. With the same number of terms the square is approximated worse than the smooth trefoil, and the readout shows it: compare both at 12 terms.

**Known series.** Three curves fix their circles in closed form, and the claims read them against the plate. The heart is a trigonometric polynomial of degree 4, eight circles in 34ths. The trefoil is three. The square, traced at constant speed, has a velocity that jumps only at its four corners: the second difference of its samples vanishes elsewhere, so its transform is a single pattern, a circle on every fourth frequency from 1 with radius ∝ 1/sin²(πk/N). That is the sampled form of the familiar 1/k² series of a polygon, and the second circle's ratio shows the difference: 0.111156 at 256 samples, 0.111828 at 64, against 1/9 for the continuous curve. The readout *second circle / largest* gives that ratio and the second circle's frequency.

**Data.** The plate takes no data of a reader's: a closed curve would be a two-column `table` of points (ADR 0010), but this plate has not adopted it; that waits on the per-engine upload slices.
