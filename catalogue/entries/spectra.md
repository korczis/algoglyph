---
id: spectra
title: Spectral Lines and a Grating's Resolving Power
taxonomy: physics/optics
status: live
engine: custom
schema: algoglyph.entry/v2
aliases:
  - line shape
  - Doppler broadening
  - Voigt profile
  - sodium D lines
  - instrument function
sources:
  - id: feynman-lectures
    ref: 'Vol. I, ch. 30 (the grating and its resolving power, mN) and ch. 32 (radiation damping, and why a line has a width)'
    purpose: further-reading
  - id: born-wolf-optics
    ref: 'Chapter 8: the diffraction grating, its intensity function and its resolving power'
    purpose: proof
  - id: weideman-1994
    ref: 'the rational series for w(z), its coefficients from a transform of (L² + t²)e^(−t²)'
    purpose: implementation
  - id: abramowitz-stegun
    ref: '7.1.5 and 7.1.14 (the power series of erf and the continued fraction of erfc)'
    purpose: proof
  - id: olivero-longbothum-1977
    ref: 'the fit f_V ≈ 0.5346 f_L + √(0.2166 f_L² + f_G²)'
    purpose: proof
  - id: nist-asd
    ref: 'Na I 588.9950 and 589.5924 nm, Hg I 576.9598 and 579.0663 nm (air)'
    purpose: data
  - id: codata-2018
    ref: 'k, c and the atomic mass unit'
    purpose: data
tags:
  - spectroscopy
  - line width
  - Doppler
  - Lorentzian
  - grating
  - resolving power
complexity: O(N × 240) per change for the recording, O(40 × 161) for each line's own shape
interaction: Choose the lamp; the sliders set the vapour's temperature, the Lorentzian width, the grooves lit and the order.
motivation: A spectral line is never a line, and a spectrometer never shows one as it is; seeing both widths at once, the atoms' and the instrument's, is what deciding whether two lines are resolved takes.
relations:
  - type: related_to
    target: far-field-diffraction
    reason: Both draw the N-slit intensity sin²(Nφ/2)/(N² sin²(φ/2)); there it is a pattern in angle for one wavelength, here it is the spectrometer's response in wavelength at one angle, smeared over each line.
  - type: related_to
    target: window-leakage
    reason: A grating of N grooves sees a wavelength through the same kernel as a transform of N samples taken through a rectangular window sees a frequency; its main lobe is the resolution λ/mN and its side lobes are the leakage.
pedagogy:
  difficulty: intermediate
  objectives:
  - Read a line's Doppler width from the temperature and the atom's mass, and its Lorentzian width from decay and collisions.
  - See that the two widths do not add, the line's shape being their convolution, the Voigt profile.
  - Find the grooves a grating needs to separate a pair of lines, N ≥ λ̄/(mΔλ), and see the dip between them appear.
  misconceptions:
  - A spectrometer's trace is not the line's shape; at any ordinary resolving power it is the instrument's shape, placed at the line.
  - Doubling the order resolves the same as doubling the grooves only to first order; what fixes the resolution is the product mN.
  questions:
  - How many grooves must a grating have to separate sodium's D lines in the first order, and in the third?
  - Why does heating the lamp from 300 K to 3000 K hardly change what a grating of 1200 grooves records?
algorithm:
  paradigm: transform
bounds:
  model: one rational series of 40 terms per point of a line's shape; one Fourier sum of N terms per recorded wavelength and line
  worst: '3000 grooves × 240 wavelengths × 2 lines, 1.4 million terms of Clenshaw''s recurrence'
experiments:
  - id: sodium-resolved
    title: Sodium resolved by 1000 grooves
    params: { lamp: sodium, grooves: 1000, width: 0 }
    observe: 'The D lines are 0.5974 nm apart at 589.29 nm, so a grating needs mN ≥ 986.4; at 1000 grooves the recording dips to 0.59 of the stronger line between them.'
  - id: sodium-blended
    title: Sodium blended at 600 grooves
    params: { lamp: sodium, grooves: 600, width: 0 }
    observe: The instrument's width, λ̄/mN = 0.98 nm, is wider than the pair's separation, and the recording shows one line with a shoulder.
  - id: third-order
    title: The third order does what three times the grooves do
    params: { lamp: sodium, grooves: 400, order: 3, width: 0 }
    observe: 400 grooves in the third order resolve the D lines like 1200 in the first; mN is 1200 either way.
  - id: mercury-pair
    title: Mercury's yellow pair at 300 grooves
    params: { lamp: mercury, grooves: 300, width: 0 }
    observe: The pair is 2.1 nm apart, so mN = 275 is enough; at 300 the dip between them is 0.66 of a line.
  - id: hot-and-collided
    title: A hot, dense vapour
    params: { T: 3000, width: 20, grooves: 3000, order: 3 }
    observe: At 3000 K the Doppler width is 4.8 pm, and collisions make the Lorentzian 20 pm; at mN = 9000 the instrument's width is 65 pm, and the recorded lines are visibly fatter than the instrument alone would draw them.
claims:
  - id: doppler-width-sodium
    statement: >-
      Sodium's D2 line at 500 K: atoms of 22.99 u have a velocity component spread of √(kT/M), so the
      Gaussian's full width at half maximum is λ√(8 ln 2 · kT/(Mc²)) = 1.967358 pm. The plate finds it
      by bisection on its own profile, computed from the Faddeeva function with no Lorentzian.
    readout: Doppler width, measured on the profile
    expect: { value: 1.96736, tolerance: 0.00001 }
    setup:
      params: { T: 500 }
  - id: doppler-width-mercury
    statement: >-
      Mercury's 576.96 nm line at 300 K: the heavier atom (200.59 u) and the colder vapour give
      λ√(8 ln 2 · kT/(Mc²)) = 0.505366 pm.
    readout: Doppler width, measured on the profile
    expect: { value: 0.50537, tolerance: 0.00001 }
    setup:
      params: { lamp: mercury, T: 300 }
  - id: voigt-peak-is-erfcx
    statement: >-
      The Voigt profile's peak is erfcx(γ/(σ√2))/(σ√2π), with erfcx(y) = e^(y²)erfc(y) summed from
      erf's power series or Laplace's continued fraction, never from w(z). The profile, from
      Weideman's 40-term series, meets it to a few roundings: within 1e−13.
    readout: peak against erfcx(γ/σ√2)/(σ√2π)
    expect: { below: 1.0e-13 }
  - id: voigt-peak-wide-lorentzian
    statement: >-
      The same at a Lorentzian of 20 pm, ten times the Doppler width, where erfcx comes from the
      continued fraction: within 1e−13.
    readout: peak against erfcx(γ/σ√2)/(σ√2π)
    expect: { below: 1.0e-13 }
    setup:
      params: { width: 20 }
  - id: voigt-width-olivero
    statement: >-
      The widths do not add: a Gaussian of 1.967 pm and a Lorentzian of 1 pm make a line 2.556 pm
      wide, measured by bisection. Olivero and Longbothum's fit, accurate to about 2.4 parts in 10⁴
      over every ratio of the two, agrees within 2.5e−4.
    readout: width against Olivero–Longbothum
    expect: { below: 2.5e-4 }
  - id: sodium-dip-at-1000
    statement: >-
      Through 1000 grooves in the first order, lines of no width would record (1 + ½)F(Δ/2) at their
      midpoint and 1 + ½F(Δ) at the stronger one, F the instrument's sin²(Nφ/2)/(N² sin²(φ/2)): a
      ratio of 0.591211. The plate sums the Fourier series of each Doppler-broadened line through the
      instrument instead, and the lines' width of 2 pm against the instrument's 589 pm moves it by
      under 1e−5.
    readout: recorded at the midpoint, over its value at the first line
    expect: { value: 0.591211, tolerance: 0.00002 }
    setup:
      params: { lamp: sodium, grooves: 1000, order: 1, width: 0 }
  - id: mercury-dip-at-300
    statement: >-
      Mercury's equal pair through 300 grooves: 2F(Δ/2)/(1 + F(Δ)) = 0.658987 for lines of no width;
      the recording of the broadened lines meets it within 1e−5.
    readout: recorded at the midpoint, over its value at the first line
    expect: { value: 0.658987, tolerance: 0.00001 }
    setup:
      params: { lamp: mercury, grooves: 300, order: 1, width: 0 }
---

Two close lines of a lamp, each as wide as the motion and the decay of its atoms make it, and what a grating spectrometer records of them.

A line is not a line. Its atoms move, each toward or away from the spectrometer, and each one's light is Doppler shifted by its velocity over c; the shifts follow the velocities, a Gaussian of spread √(kT/M). Every excited atom also decays, and collides with its neighbours, which cuts its wave train short and spreads its light into a Lorentzian. The line's shape is the two convolved, the Voigt profile, the real part of the Faddeeva function w(z), which the plate evaluates by Weideman's rational series. Its width is not the sum of the two widths, and the readout measures it against a fit, Olivero and Longbothum's, that never computes a profile.

The spectrometer adds its own shape. A grating of N grooves lit, used in order m, cannot tell apart wavelengths closer than about λ/mN: at one angle it passes the wavelength of that angle and its neighbours with the weight sin²(Nφ/2)/(N² sin²(φ/2)), the same function a far-field pattern of N slits draws. The recording is each line convolved with that weight; the plate computes it exactly, as the weight's Fourier series with each term damped by the line's own transform, e^(−σ²k²/2 − γ|k|). Sodium's D lines, 0.597 nm apart, need mN ≥ 986; the readouts compare the recorded dip between them with what lines of no width would give, in closed form.

**A still.** Nothing in the picture moves: the light is not followed in time, only its shapes are computed, so the diagram is redrawn when a control changes and every readout is computed from the controls alone. The state travels in the URL.

**Data.** The plate takes no data of a reader's: its lines are two tabled doublets, and a measured spectrum is not among the kinds ADR 0010 can read.
