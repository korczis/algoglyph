---
id: crystal-diffraction
title: Crystal Diffraction
taxonomy: physics/optics
status: live
engine: custom
schema: algoglyph.entry/v2
aliases:
  - X-ray diffraction
  - Bragg's law
  - structure factor
  - systematic absences
  - powder diffraction
sources:
  - id: feynman-lectures
    ref: 'Vol. II, ch. 30 (the internal geometry of crystals: cubic lattices and their cells)'
    purpose: further-reading
  - id: ashcroft-mermin-1976
    ref: 'Chapter 6: the determination of crystal structures by X-ray diffraction, the structure factor and its absences'
    purpose: implementation
  - id: bragg-1913
    purpose: further-reading
tags:
  - X-ray diffraction
  - Bragg's law
  - reciprocal lattice
  - structure factor
  - selection rules
  - powder diffraction
  - three-dimensional FFT
complexity: O(N³ log N) for the 32³ transform; 342 reflections read off it
interaction: Choose the crystal, its cube edge and the X-rays' wavelength; the layer of the reciprocal lattice shown; drag the cell to turn it. The diffractometer scans 2θ from 0° to 180° as the run goes.
motivation: A crystal diffracts X-rays only in the directions where the waves from every cell agree, and within those, the atoms of one cell may still cancel; which reflections vanish tells a body-centred crystal from a face-centred one without ever seeing an atom.
relations:
  - type: derived_from
    target: far-field-diffraction
    reason: The same far field one dimension up; there an aperture's two-dimensional transform, here a crystal's three-dimensional one, with every cell an aperture repeated.
  - type: uses
    target: fft-butterfly
    reason: The crystal's transform is the radix-2 FFT along each of its three axes in turn.
pedagogy:
  difficulty: intermediate
  objectives:
    - Find which reflections a body-centred cubic crystal lacks (h + k + l odd) and which a face-centred one lacks (mixed parity), from its transform.
    - Read the structure factor |F(hkl)|² off the transform and match it to the basis's atoms in phase.
    - Tell the four cubic crystals apart by the sequence h² + k² + l² of their powder lines.
    - Place each line at 2θ = 2 asin(λ√(h² + k² + l²)/2a), Bragg's law for the cubic cell.
  misconceptions:
    - An absent reflection is not too faint to see; the atoms of the cell cancel it exactly.
    - Bragg's law alone does not say which lines appear; it says where they would be, and the structure factor says whether they are there.
    - Simple cubic and body-centred cubic powder patterns look alike at first; the seventh line, 8 against 14, tells them apart.
  questions:
    - Why does a body-centred crystal have no (100) reflection, when its cube has (100) faces?
    - Which reflections of diamond survive the face-centred rule but vanish anyway, and why?
    - What happens to the powder lines when the cube edge doubles?
    - Why is (111) the strongest line of diamond-structure silicon, and (220) stronger than (111) in |F|²?
algorithm:
  paradigm: simulation
  properties:
    deterministic: true
  preconditions:
    - Point scatterers of equal weight (no atomic form factor, no thermal motion), on a cubic cell; the crystal is four cells along each axis, periodic.
    - Kinematic (single) scattering; X-rays of one wavelength.
  invariants:
    - A reflection's |F|² is read off the transform of the whole crystal, never computed from the rule; round-off leaves an absent one some 1e−28 of an atom's.
    - Reflections are read for |h|, |k|, |l| ≤ 3, below the transform's Nyquist bin, so powder lines up to h² + k² + l² = 15 are complete.
  limitations:
    - Atoms sit on eighths of the cell; a reader's basis is snapped to them, and the plate says how many atoms moved.
    - No form factor or Debye–Waller factor, so line intensities do not fall with angle; the Lorentz-polarisation factor is not applied.
    - Only cubic cells.
experiments:
  - id: iron-bcc
    title: Iron, body-centred
    params: { lattice: bcc, a: 2.87, lambda: 1.54 }
    observe: The lines fall at h² + k² + l² = 2, 4, 6, 8, …; every reflection with h + k + l odd is gone.
  - id: copper-fcc
    title: Copper, face-centred
    params: { lattice: fcc, a: 3.61, lambda: 1.54 }
    observe: The lines pair up as 3, 4, then 8, then 11, 12, the face-centred signature.
  - id: silicon-diamond
    title: Silicon, the diamond structure
    params: { lattice: diamond, a: 5.43, lambda: 1.54 }
    observe: Of the face-centred lines, 4 and 12 vanish as well; the second basis atom at a quarter of the diagonal cancels them.
  - id: polonium-sc
    title: Polonium, simple cubic
    params: { lattice: sc, a: 3.35, lambda: 1.54 }
    observe: Every line is there except 7 and 15, which no three squares make.
  - id: bcc-upper-layer
    title: The next layer of a body-centred crystal
    params: { lattice: bcc, layer: 1 }
    observe: In the layer l = 1 the surviving spots are those with h + k odd, the checkerboard of l = 0 shifted by one.
  - id: short-wavelength
    title: Shorter X-rays crowd the lines
    params: { lattice: fcc, a: 3.61, lambda: 0.71 }
    observe: With Mo Kα the same lines move to smaller angles, and all of them fit below 90°.
claims:
  - id: bcc-rule
    statement: >-
      Of the 342 reflections with |h|, |k|, |l| ≤ 3, those present on the body-centred crystal's transform are
      exactly those with h + k + l even: no reflection disagrees with the rule.
    readout: reflections disagreeing with the selection rule, counted
    expect: { value: 0 }
  - id: fcc-rule
    statement: >-
      On the face-centred crystal exactly the reflections with h, k, l all even or all odd are present.
    readout: reflections disagreeing with the selection rule, counted
    expect: { value: 0 }
    setup:
      params: { lattice: fcc }
  - id: diamond-rule
    statement: >-
      On diamond exactly the face-centred reflections with all indices odd, or all even and h + k + l a multiple of
      4, are present.
    readout: reflections disagreeing with the selection rule, counted
    expect: { value: 0 }
    setup:
      params: { lattice: diamond }
  - id: sc-nothing-absent
    statement: >-
      A simple cubic crystal, one atom a cell, lacks no reflection.
    readout: 'reflections absent, |F|² below 1e−9 of one atom’s'
    expect: { value: 0 }
    setup:
      params: { lattice: sc }
  - id: bcc-200
    statement: >-
      The body-centred (200) reflection has |F|² = 4, the two atoms in phase, within 1e−9 on the transform.
    readout: '|F(200)|², measured on the transform'
    expect: { against: '|F(200)|² by the rule', tolerance: 0.000000001 }
  - id: bcc-111-absent
    statement: >-
      Its (111) vanishes, |F|² within 1e−9 of 0: the body-centre atom is half a wavelength out of phase.
    readout: '|F(111)|², measured on the transform'
    expect: { against: '|F(111)|² by the rule', tolerance: 0.000000001 }
  - id: fcc-111
    statement: >-
      The face-centred (111) has |F|² = 16, four atoms in phase, within 1e−9.
    readout: '|F(111)|², measured on the transform'
    expect: { against: '|F(111)|² by the rule', tolerance: 0.000000001 }
    setup:
      params: { lattice: fcc }
  - id: diamond-111
    statement: >-
      Diamond's (111) has |F|² = 32, |4(1 − i)|², within 1e−9: its two face-centred lattices meet a quarter-wave
      apart.
    readout: '|F(111)|², measured on the transform'
    expect: { against: '|F(111)|² by the rule', tolerance: 0.000000001 }
    setup:
      params: { lattice: diamond }
  - id: diamond-220
    statement: >-
      Its (220) has |F|² = 64, all eight atoms in phase, within 1e−9.
    readout: '|F(220)|², measured on the transform'
    expect: { against: '|F(220)|² by the rule', tolerance: 0.000000001 }
    setup:
      params: { lattice: diamond }
  - id: diamond-200-absent
    statement: >-
      And its (200), allowed in a face-centred crystal, vanishes within 1e−9.
    readout: '|F(200)|², measured on the transform'
    expect: { against: '|F(200)|² by the rule', tolerance: 0.000000001 }
    setup:
      params: { lattice: diamond }
  - id: fcc-third-line
    statement: >-
      The face-centred powder lines run 3, 4, 8, 11, 12: the third is h² + k² + l² = 8.
    readout: powder lines present, h² + k² + l² up to 15
    expect: { value: 8, number: 3 }
    setup:
      params: { lattice: fcc }
  - id: sc-seventh-line
    statement: >-
      The simple cubic seventh line is 8, because no three squares add up to 7.
    readout: powder lines present, h² + k² + l² up to 15
    expect: { value: 8, number: 7 }
    setup:
      params: { lattice: sc }
  - id: bcc-seventh-line
    statement: >-
      The body-centred seventh line is 14, twice 7: there the even sums are all present, which tells the two apart.
    readout: powder lines present, h² + k² + l² up to 15
    expect: { value: 14, number: 7 }
data:
  - id: basis
    title: Your basis
    kind: table
    accepts: [csv, json]
    columns:
      - { key: u, unit: 'fraction of the cube edge (1)', min: 0, max: 1 }
      - { key: v, unit: 'fraction of the cube edge (1)', min: 0, max: 1 }
      - { key: w, unit: 'fraction of the cube edge (1)', min: 0, max: 1 }
      - { key: f, unit: 'scattering weight (1)', min: 0, max: 100 }
    rows: { min: 1, max: 64 }
    bytes: 8192
    replaces: lattice
    url_bytes: 1800
    note: Each row is an atom of the cubic cell at fractional coordinates (u, v, w), snapped to the nearest eighth of the edge, with its scattering weight; the cell is repeated four times along each axis and transformed.
---

X-rays meeting a crystal: a cubic cell of point scatterers repeated in three dimensions, the crystal's diffraction computed as one three-dimensional Fourier transform, the reflections that survive it, and the powder pattern a diffractometer would record as it scans the angle 2θ.

**The lattice and the cell.** The waves scattered by every cell of a crystal agree only in the directions where the change of wave vector is a vector of the reciprocal lattice, (h, k, l) times 2π/a for a cubic cell of edge a. Those are Bragg's reflections, at 2θ = 2 asin(λ√(h² + k² + l²)/2a). Within each, the atoms of one cell add with their own phases, F(hkl) = Σ f e^(2πi(hu + kv + lw)), and the reflection's strength is |F|².

**The transform, measured.** The plate does not sum F from the rule. It puts the cell's atoms on a 32³ grid, four cells along each axis, takes the transform along x, along y and along z with the shared radix-2 FFT, and reads each reflection at the bin (4h, 4k, 4l); over the square of the number of cells that is |F(hkl)|², exactly for point scatterers. A reflection that the atoms cancel comes out at round-off, some 1e−28 of an atom's.

**The rules.** A body-centred cell has a second atom at (½, ½, ½), whose phase is (−1)^(h+k+l): every reflection with h + k + l odd vanishes. A face-centred cell has three more at the face centres, and only the reflections with indices all even or all odd survive, with |F|² = 16. Diamond is two face-centred lattices a quarter of the diagonal apart; of the face-centred reflections it keeps the all-odd ones, at |F|² = 32, and the all-even ones whose sum is a multiple of 4, at 64. The plate counts the reflections present on the transform that the rule forbids, or absent that it allows; the claims hold that count to zero.

**Powder lines.** A powder holds every orientation at once, so each set of reflections with one h² + k² + l² makes a cone, a line at one 2θ. Simple cubic gives 1, 2, 3, 4, 5, 6, 8, missing 7 because no three squares make it; body-centred gives 2, 4, 6, 8, 10, 12, 14; face-centred 3, 4, 8, 11, 12; diamond 3, 8, 11. The run scans 2θ like a diffractometer and draws each line as it is passed. The two-dimensional case, one aperture rather than a repeated cell, is #/p/far-field-diffraction. A reader's own basis of atoms replaces the cubic lattices; it stays in the browser.
