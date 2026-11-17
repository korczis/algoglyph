---
id: far-field-diffraction
title: Far-Field Diffraction
taxonomy: physics/optics
status: live
engine: custom
schema: algoglyph.entry/v2
aliases:
  - Fraunhofer diffraction
  - single-slit diffraction
  - diffraction grating
  - Airy disc
  - resolving power
sources:
  - id: feynman-lectures
    ref: 'Vol. I, ch. 30 (diffraction: the resultant amplitude of N equal oscillators, the grating and its resolving power, the far field of an opening)'
    purpose: further-reading
  - id: born-wolf-optics
    ref: 'Chapter 8: Fraunhofer diffraction at a rectangular and a circular aperture, and by a grating'
    purpose: implementation
  - id: cooley-tukey
    purpose: implementation
tags:
  - Fraunhofer diffraction
  - Fourier optics
  - diffraction grating
  - Airy pattern
  - Bessel function
  - two-dimensional FFT
  - photon counting
complexity: O(G² log G) for the 256 × 256 transform; each zero is bracketed on the transform's bins and bisected in O(G) a step
interaction: Choose the aperture and the wavelength; then the slit's width, the grating's slits, width and pitch, the hole's diameter, or the rectangle's sides. Light arrives photon by photon on the pattern; the cut along x is drawn on a log scale.
motivation: Far from an opening the light's amplitude is the Fourier transform of the opening, so the angle of every dark fringe follows from the opening's size alone, from a slit's λ/a to the 1.22 λ/D that limits every telescope and eye.
relations:
  - type: related_to
    target: two-slit-amplitudes
    reason: Two slits are the grating with N = 2, and both plates draw the single-slit envelope from the same far-field screen (src/plates/_shared/optics/screen.ts); there the amplitudes are counted particle by particle, here the whole pattern is one transform.
  - type: uses
    target: fft-butterfly
    reason: The far field is the aperture's two-dimensional discrete Fourier transform, a radix-2 FFT of every row and then every column.
  - type: related_to
    target: water-waves-two-slit
    reason: There the waves are stepped on a grid and the fringes form in the near field of two openings; here the far field of any opening is computed at once.
pedagogy:
  difficulty: intermediate
  objectives:
    - Measure the zeros of a single slit's pattern and find them at sin θ = mλ/a.
    - See a grating's principal maxima sharpen as N grows, with half-width λ/(Nd), while they stay at mλ/d.
    - Find the first dark ring of a circular hole at 1.21967λ/D, the first zero of J₁ over π.
    - Read off the two widths of a rectangular hole from the two axes of its pattern, each inversely.
  misconceptions:
    - A narrower opening does not give a narrower beam; the pattern widens as 1/a.
    - The 1.22 of the Airy ring is not a fitted factor; it is the first zero of the Bessel function J₁ divided by π.
    - The orders of a grating do not move when more slits are added; only their width shrinks, which is what resolves two wavelengths.
    - A wide rectangle gives a pattern that is narrow along its width and wide along its height, the transform's inverse scaling.
  questions:
    - Why does halving the slit double the angle of its first zero?
    - How many slits must a grating with d = 12 µm have to separate two lines 1 nm apart at 500 nm in the first order?
    - Why is the dark ring of the pixelated disc found at its area's diameter rather than at the diameter it was drawn with?
    - What happens to the pattern of a grating when each slit is made wider, and which orders disappear?
algorithm:
  paradigm: simulation
  properties:
    deterministic: true
  preconditions:
    - A monochromatic plane wave at normal incidence; the screen in the far field, so the pattern depends only on direction; scalar light.
    - The aperture is sampled on 256 × 256 cells of 1 µm; bin k from the centre is sin θ = kλ/(256 µm).
  invariants:
    - The zeros are measured on the transform of the sampled aperture, never computed from a formula; a slit of n cells has its zeros at exactly k = m·256/n.
    - The photons are drawn from the computed intensity; they show how the pattern builds up and carry no claim.
  limitations:
    - The transform is periodic, so angles beyond ±λ/(2 µm) alias; the pattern is shown within them.
    - A pixelated disc is not a circle; its dark ring follows 1.21967λ/D with D from its area within 2.4e−4, but it may be off by one or two per cent from the diameter drawn when D is small.
    - Polarisation, obliquity and the near field (Fresnel diffraction) are not modelled.
experiments:
  - id: single-slit
    title: A single slit
    params: { aperture: slit, a: 20 }
    observe: The central band is twice as wide as the others; the zeros fall at sin θ = 0.025, 0.05, … for a = 20 µm at 500 nm.
  - id: narrow-slit
    title: A narrower slit spreads the light more
    params: { aperture: slit, a: 5 }
    observe: At a quarter of the width the first zero moves four times further out, to sin θ = 0.1.
  - id: young-two-slits
    title: Two slits
    params: { aperture: grating, N: 2, ga: 4, d: 12 }
    observe: The single-slit envelope is filled with fringes at λ/d, the two-slit pattern of Young.
  - id: grating-five
    title: A grating of five slits
    params: { aperture: grating, N: 5, ga: 4, d: 12 }
    observe: Between the principal maxima at mλ/d sit three weak ones; each principal maximum is λ/(5d) wide to its first zero.
  - id: grating-sixteen
    title: Sixteen slits resolve more finely
    params: { aperture: grating, N: 16, ga: 8, d: 16 }
    observe: The principal maxima narrow to λ/(16d) and the even orders vanish, because each slit fills half the pitch.
  - id: airy-disc
    title: The Airy disc of a round hole
    params: { aperture: circle, D: 48 }
    observe: A bright disc surrounded by faint rings, the first dark one at 1.22λ/D.
  - id: large-hole
    title: A large hole, a small disc
    params: { aperture: circle, D: 200 }
    observe: The disc shrinks to a few bins across; the limit of resolution of an aperture this size.
  - id: rectangle
    title: A rectangle's two widths
    params: { aperture: rectangle, w: 24, h: 40 }
    observe: The pattern is wider along x than along y, its zeros at λ/w and λ/h.
claims:
  - id: slit-first-zero
    statement: >-
      A slit 20 µm wide at 500 nm has its first zero at sin θ = λ/a = 0.025 within 1e−9, found on its transform.
    readout: first zero of the pattern, sin θ, measured
    expect: { against: first zero λ/a, tolerance: 0.000000001 }
  - id: slit-second-zero
    statement: >-
      Its second zero lies at 2λ/a = 0.05 within 1e−9.
    readout: second zero, sin θ, measured
    expect: { against: second zero 2λ/a, tolerance: 0.000000001 }
  - id: narrow-slit-zero
    statement: >-
      A slit of 5 µm at 650 nm has its first zero at λ/a = 0.13 within 1e−9.
    readout: first zero of the pattern, sin θ, measured
    expect: { against: first zero λ/a, tolerance: 0.000000001 }
    setup:
      params: { a: 5, lambda: 650 }
  - id: grating-width
    statement: >-
      Five slits at a pitch of 12 µm make each principal maximum λ/(Nd) = 0.0083 wide to its first zero, within
      1e−9.
    readout: first zero beside the central maximum, sin θ, measured
    expect: { against: half-width of a principal maximum λ/(Nd), tolerance: 0.000000001 }
    setup:
      params: { aperture: grating }
  - id: grating-order
    statement: >-
      The first order lies at λ/d = 0.0417 within 1e−9, midway between the two zeros beside it.
    readout: first order, midway between its neighbouring zeros, sin θ, measured
    expect: { against: first order λ/d, tolerance: 0.000000001 }
    setup:
      params: { aperture: grating }
  - id: grating-sixteen-width
    statement: >-
      With sixteen slits at 16 µm the half-width falls to λ/(Nd) = 0.00195, within 1e−9.
    readout: first zero beside the central maximum, sin θ, measured
    expect: { against: half-width of a principal maximum λ/(Nd), tolerance: 0.000000001 }
    setup:
      params: { aperture: grating, N: 16, ga: 8, d: 16 }
  - id: airy-ring
    statement: >-
      A hole of 48 µm has its first dark ring, the mean of its zeros along x and along the diagonal, at 1.21967λ/D
      with D from the pixel disc's area, within 3e−6 in sin θ (2.4e−4 of it), the band measured over holes from
      8 to 128 µm other than this one.
    readout: first dark ring, mean of the two, sin θ
    expect: { against: 'Airy ring 1.21967λ/D, D from the disc’s area', tolerance: 0.000003 }
    setup:
      params: { aperture: circle }
  - id: airy-ring-drawn
    statement: >-
      Against the diameter as drawn the ring is within 0.5 per cent, 6.4e−5 in sin θ, as for every hole of 32 µm
      or more.
    readout: first dark ring, mean of the two, sin θ
    expect: { against: 'Airy ring 1.21967λ/D, D as drawn', tolerance: 0.000064 }
    setup:
      params: { aperture: circle }
  - id: rectangle-x
    statement: >-
      A hole 24 µm wide has its first zero along x at λ/w within 1e−9.
    readout: first zero along x, sin θ, measured
    expect: { against: 'first zero along x, λ/w', tolerance: 0.000000001 }
    setup:
      params: { aperture: rectangle }
  - id: rectangle-y
    statement: >-
      And 40 µm tall, its first zero along y at λ/h within 1e−9: the narrower side gives the wider pattern.
    readout: first zero along y, sin θ, measured
    expect: { against: 'first zero along y, λ/h', tolerance: 0.000000001 }
    setup:
      params: { aperture: rectangle }
data:
  - id: profile
    title: Your aperture profile
    kind: series
    accepts: [csv, json]
    columns:
      - { key: t, unit: 'amplitude transmission (1)', min: 0, max: 1 }
    rows: { min: 2, max: 256 }
    bytes: 16384
    replaces: aperture
    ignores: [a, ga, N, d, D, w, h]
    url_bytes: 1800
    note: Each row is the amplitude transmission of one micrometre across the opening, from 0 (opaque) to 1 (open); the profile is centred on the grid and extended 64 µm along y, and its far field is the transform of that sheet.
---

Light through an opening, seen far away: a slit, a grating, a round hole or a rectangle, sampled on a grid of 256 × 256 micrometres, its far-field pattern computed as one two-dimensional Fourier transform, and photons landing on that pattern one at a time.

**The far field.** Every point of the opening sends out a wavelet; far away, in the direction θ, the wavelets from points a distance x apart differ in phase by 2πx sin θ/λ. The amplitude is therefore the sum of the opening's transmission times e^(−2πix sin θ/λ), its Fourier transform at the spatial frequency sin θ/λ. On the grid that sum is the discrete transform, computed by the radix-2 FFT of every row and then of every column, and bin k from the centre is the direction sin θ = kλ/(256 µm).

**Zeros, measured.** The plate does not put the closed forms into the picture. Along an axis the amplitude of a symmetric opening is real, the sum of the column totals times a cosine; the plate brackets its first change of sign on the transform's bins and bisects it as a function of a fractional bin. A slit of n cells has as that sum the Dirichlet kernel sin(πkn/G)/sin(πk/G), whose zeros fall exactly where the continuous slit's do, at sin θ = mλ/a.

**A grating.** N slits at the pitch d add N equal amplitudes with the phase step 2πd sin θ/λ between neighbours; they all agree at sin θ = mλ/d, the orders, and the first zero beside an order comes when the N phases close a full circle, λ/(Nd) further on. The plate measures that half-width, and the first order as the midpoint of its two neighbouring zeros. The slit's own envelope multiplies the pattern, drawn dashed from the same far-field screen as #/p/two-slit-amplitudes; where it has a zero an order is missing.

**A round hole.** Its transform is 2J₁(v)/v, and the first dark ring is the first zero of J₁ divided by π, 1.21967λ/D; the plate finds that constant by bisecting J₁'s series. A disc of square cells is not a circle, and its ring sits at 1.21967λ/D for the diameter of a circle of the same area, within a few parts in ten thousand; against the diameter it was drawn with it is off by up to two per cent when the hole is small. The plate states both.

**Photons.** The intensity, normalised, is the probability of where a photon lands; the plate draws photons from it, fifty to a batch, and the pattern builds up from scattered dots. A reader's own transmission profile replaces the opening and is transformed in the same way; the data stays in the browser.
