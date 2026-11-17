---
id: string-and-sound
title: A Plucked String and Its Harmonics
taxonomy: physics/waves
status: live
engine: numeric
schema: algoglyph.entry/v2
aliases:
  - vibrating string
  - normal modes
  - harmonics
  - overtones
  - plucked string
sources:
  - id: feynman-lectures
    ref: 'Vol. I, ch. 49 (Modes: the string fixed at both ends, its frequencies nc/2L) and ch. 50 (Harmonics: a plucked string as a sum of modes)'
    purpose: further-reading
tags:
  - wave equation
  - normal modes
  - harmonics
  - leapfrog
  - Fourier analysis
  - spectrum
  - dispersion relation
complexity: O(L) per step; ten periods of the fundamental, about 10L/C steps, then one DFT bin per harmonic over that record
interaction: Choose where the string is plucked and the scheme's Courant number; the run replays two periods of the string, and the bars show the harmonics a pickup hears against their closed form.
motivation: A string fixed at both ends can only vibrate in modes that fit a whole number of half-waves, so a pluck sounds the fundamental c/2L and its whole-number multiples, and where it is plucked decides how loud each one is; a node at the pluck silences that harmonic altogether.
relations:
  - type: related_to
    target: ripple-tank
    reason: The same leapfrog stencil (src/plates/_shared/wave2d/leapfrog.ts), on a line here and on a grid there; its dispersion relation sin(ω/2) = C sin(k/2) sets the modes here and the wavelengths there.
  - type: related_to
    target: fft-butterfly
    reason: The harmonics are read from the pickup's record by a discrete Fourier transform, one bin per harmonic, the sum the fast transform computes all at once.
  - type: related_to
    target: finite-differences
    reason: The stencil is the central second difference, second order in the step, in time and in space; at C = 1 on a line its errors in the two cancel and the scheme is exact.
pedagogy:
  difficulty: introductory
  objectives:
    - Measure the fundamental of a string of L cells from a pickup's record and match it to c/2L.
    - See that a plucked string sounds only whole-number multiples of the fundamental, and measure their amplitudes against the closed form for a pluck at p heard at q.
    - Find the harmonic a pluck at L/n silences, the one with a node at the pluck.
    - See the scheme's own dispersion below C = 1 make the string slightly inharmonic, by the amount sin(ω/2) = C sin(k/2) predicts.
  misconceptions:
    - The harmonics of a string are not added by the instrument; a pluck is a sum of the string's modes, and the modes of a uniform string fixed at both ends are whole-number multiples of the fundamental.
    - Plucking harder changes the loudness, not the mixture; where the string is plucked changes the mixture.
    - A numerical string is not automatically harmonic; a scheme with dispersion detunes its overtones, and only at C = 1 is the leapfrog line exact.
  questions:
    - Why does a pluck at the middle sound no even harmonics?
    - Why does the second harmonic grow louder as the pluck moves from the middle towards a fifth?
    - At C² = 0.25, is the seventh harmonic sharp or flat of seven times the fundamental, and by how much?
algorithm:
  paradigm: simulation
  properties:
    deterministic: true
  preconditions:
    - L = 240 cells with both ends fixed, released from rest in a unit triangle with its apex at the pluck point; the pickup sits at cell 31 (0.13 L, where no low harmonic has a node).
  invariants:
    - The string is stepped by the shared leapfrog stencil and released from rest with u⁻ = u + (C²/2)Δu, so that u(−1) = u(1).
    - Frequencies are read from the spectrum (Hann window, one DFT bin per harmonic, a parabola through the log magnitudes), never from the scheme's formula, and compared with it.
  limitations:
    - Ten periods of the fundamental are recorded; at C = 1 they are a whole number of steps and every harmonic falls on a bin; below it the window's leakage limits a frequency to about 1e−5 of its value and a silent harmonic to about 3e−6 of the fundamental.
    - The string is lossless, uniform and fixed at both ends; no stiffness, damping or body is modelled, and the plate does not play the sound.
experiments:
  - id: pluck-fifth
    title: Plucked at a fifth
    params: { c2: '1', pluck: '0.2' }
    observe: Harmonics 1 to 4 sound, the fifth is silent (a node at the pluck), and 6 to 9 sound again; each bar meets its closed-form tick.
  - id: pluck-middle
    title: Plucked at the middle
    params: { c2: '1', pluck: '0.5' }
    observe: Only odd harmonics sound; every even one has a node at the middle.
  - id: pluck-third
    title: Plucked at a third
    params: { c2: '1', pluck: '0.333333' }
    observe: The third, sixth, ninth and twelfth harmonics are silent.
  - id: coarse-scheme
    title: A dispersive scheme, C² = 0.25
    params: { c2: '0.25', pluck: '0.2' }
    observe: The overtones fall slightly flat of whole-number multiples, the seventh by about 0.002 of the fundamental, as the scheme's dispersion relation says.
claims:
  - id: fundamental-c-over-2l
    statement: >-
      At C = 1 the string of L = 240 cells sounds its fundamental at c/2L = 1/480 cycles a step: the peak of
      the pickup's spectrum lies within 1e−9 of it.
    readout: Fundamental, measured (cycles per step)
    expect: { against: 'Fundamental c / 2L, closed form', tolerance: 0.000000001 }
    setup:
      params: { c2: '1', pluck: '0.2' }
  - id: harmonics-whole-multiples
    statement: >-
      Its overtones are whole-number multiples: the seventh harmonic's measured frequency is 7 times the
      fundamental's within 1e−6.
    readout: 7th harmonic over the fundamental, measured
    expect: { value: 7, tolerance: 0.000001 }
    setup:
      params: { c2: '1', pluck: '0.2' }
  - id: node-silences-harmonic
    statement: >-
      Plucked at a fifth, the fifth harmonic has a node at the pluck and is silent: its amplitude at the
      pickup is below 1e−10 of the fundamental's.
    readout: Missing harmonic’s amplitude over the fundamental’s
    expect: { below: 0.0000000001 }
    setup:
      params: { c2: '1', pluck: '0.2' }
  - id: second-harmonic-amplitude
    statement: >-
      The second harmonic's amplitude over the fundamental's, plucked at a fifth, equals the closed form for
      the plucked string of L cells, |sin 2πp sin 2πq| sin²(π/2L) / (|sin πp sin πq| sin²(π/L)), within 1e−5.
    readout: 2nd harmonic’s amplitude over the fundamental’s, measured
    expect: { against: '2nd harmonic’s amplitude, closed form for the plucked string of L cells', tolerance: 0.00001 }
    setup:
      params: { c2: '1', pluck: '0.2' }
  - id: middle-pluck-no-even-harmonics
    statement: >-
      Plucked at the middle, the second harmonic has a node at the pluck: its amplitude is below 1e−10 of the
      fundamental's.
    readout: Missing harmonic’s amplitude over the fundamental’s
    expect: { below: 0.0000000001 }
    setup:
      params: { c2: '1', pluck: '0.5' }
  - id: scheme-fundamental
    statement: >-
      At C² = 0.5 the measured fundamental follows the scheme's dispersion relation, ω(π/L)/2π with
      sin(ω/2) = C sin(k/2), within 1e−8 cycles a step.
    readout: Fundamental, measured (cycles per step)
    expect: { against: 'Fundamental of the scheme, ω(π/L) / 2π', tolerance: 0.00000001 }
    setup:
      params: { c2: '0.5', pluck: '0.2' }
  - id: dispersive-scheme-inharmonic
    statement: >-
      At C² = 0.25 the scheme detunes the overtones: the seventh harmonic over the fundamental is the
      scheme's ω₇/ω₁ ≈ 6.9982 within 5e−4, not 7.
    readout: 7th harmonic over the fundamental, measured
    expect: { against: '7th over the fundamental, the scheme’s ω₇ / ω₁', tolerance: 0.0005 }
    setup:
      params: { c2: '0.25', pluck: '0.2' }
---

A string fixed at both ends, plucked and left to ring, and the harmonics a pickup hears.

**Modes.** A string of length L fixed at both ends can hold a standing wave only if a whole number of half-waves fits: wavelengths 2L/n, frequencies f_n = n c/2L. Every motion of the string is a sum of these modes, so a pluck sounds the fundamental and its whole-number multiples and nothing else. Its harmonics are exact multiples because the string is uniform and the wave equation is not dispersive.

**The pluck decides the mixture.** Released from rest in a triangle with its apex at p, the string's mode n starts with the weight sin(nπp)/n², and a pickup at q hears it multiplied by sin(nπq). A harmonic with a node at the pluck is never excited: plucked at the middle, the string has no even harmonics; plucked at a fifth, no fifth, tenth or fifteenth. On a string of L cells the triangle's second difference is a single spike, so the 1/n² becomes sin²(π/2L)/sin²(nπ/2L); the bars are measured from the spectrum and the ticks are that closed form.

**Measured from the sound.** The plate steps the string with the leapfrog stencil it shares with #/p/ripple-tank and records the displacement at the pickup for ten periods of the fundamental. A Hann-windowed discrete Fourier transform of that record, one bin per harmonic, gives the peaks, refined by a parabola through the log magnitudes. Frequencies and amplitudes come from the record alone and are then compared with the closed forms.

**The scheme's own dispersion.** On a line the leapfrog step obeys sin(ω/2) = C sin(k/2) with C = cΔt/Δx. At C = 1 that is ω = k for every k, and the numerical string is exactly harmonic. Below it short waves travel slower, and the overtones fall flat of whole-number multiples. At C² = 0.25 the seventh harmonic lies at about 6.998 times the fundamental, where the relation puts it.

**Data.** The plate takes no data of a reader's. Its input is where the string is plucked and the scheme's Courant number; a reader's recording would carry a body, damping and stiffness the model does not have.
