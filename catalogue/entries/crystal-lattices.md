---
id: crystal-lattices
title: Crystal Lattices, Shell by Shell
taxonomy: physics/statistical
status: live
engine: custom
schema: algoglyph.entry/v2
aliases:
  - sphere packing
  - coordination number
  - packing fraction
  - face-centred cubic
  - hexagonal close packing
  - diamond structure
sources:
  - id: feynman-lectures
    ref: 'Vol. II, ch. 30 (the internal geometry of crystals: the cubic and hexagonal lattices, close packing)'
    purpose: further-reading
  - id: ashcroft-mermin-1976
    ref: 'ch. 4 (Bravais lattices, primitive vectors, coordination numbers, the packing of spheres) and ch. 4''s diamond and hcp structures'
    purpose: proof
tags:
  - crystals
  - lattice
  - packing
  - coordination
  - solid state
complexity: O((2K + 1)³ × basis) per change, K = 4, then a sort
interaction: Choose the lattice and how many shells of neighbours are drawn; the sliders turn and tilt the view.
motivation: How many neighbours an atom has and how full space is come out of three vectors and a basis by counting, and the counts are the numbers every textbook tables.
relations:
  - type: related_to
    target: crystal-diffraction
    reason: The same five lattices seen in reciprocal space; there their structure factors decide which reflections survive, here their neighbours are counted in real space.
  - type: related_to
    target: voronoi-diagram
    reason: The region of space nearer one atom than any other is its Voronoi cell, the Wigner–Seitz cell; its faces are the perpendicular bisectors to the first shells counted here.
pedagogy:
  difficulty: introductory
  objectives:
  - Build a lattice from three primitive vectors and a basis, and count the neighbours of one atom shell by shell.
  - See that face-centred cubic and hexagonal close packing fill the same 74 % of space and both give each sphere twelve neighbours.
  - See why diamond's open structure, four neighbours each, fills only 34 %.
  misconceptions:
  - Body-centred cubic is not close-packed; its eight nearest neighbours leave a second shell of six only 15 % farther.
  - Face-centred cubic and hexagonal close packing differ not in their first shell but in how its twelve are arranged, and in the third shell.
  questions:
  - Why does hcp's third shell hold only two atoms?
  - What fraction of space would spheres fill on a simple cubic lattice, and why do almost no elements choose it?
algorithm:
  paradigm: search
bounds:
  model: every lattice point within ±4 cells, sorted
  worst: '729 cells × 2 atoms = 1458 points, enough for four shells of every lattice'
experiments:
  - id: fcc
    title: Face-centred cubic
    params: { lattice: fcc }
    observe: Twelve neighbours at a/√2, then six at a; spheres touching along the face diagonals fill π/(3√2) = 74.05 % of space.
  - id: hcp
    title: Hexagonal close-packed
    params: { lattice: hcp, shells: 3 }
    observe: The same twelve neighbours and the same 74.05 %; the third shell, two atoms straight above and below at c = √(8/3) a, is where it differs from fcc.
  - id: bcc
    title: Body-centred cubic
    params: { lattice: bcc }
    observe: Eight neighbours at √3a/2 and six more at a, only 15 % farther; 68.0 % filled.
  - id: diamond
    title: Diamond
    params: { lattice: diamond }
    observe: Four neighbours at √3a/4, a tetrahedron; the spheres fill only 34.0 %.
  - id: simple-cubic
    title: Simple cubic
    params: { lattice: sc, shells: 3 }
    observe: Six neighbours, twelve, then eight; 52.4 % of space filled.
claims:
  - id: fcc-coordination
    statement: Counted among 729 cells, the face-centred cubic lattice gives each atom 12 nearest neighbours.
    readout: nearest neighbours (coordination number)
    expect: { value: 12, tolerance: 0 }
  - id: fcc-packing
    statement: >-
      Spheres touching their nearest neighbours fill π/(3√2) = 0.740480490 of space on the fcc
      lattice, the enumerated distance and the cell's volume giving it within 1e−9.
    readout: packing fraction, enumerated
    expect: { value: 0.74048049, tolerance: 1.0e-9 }
  - id: hcp-packing
    statement: >-
      Ideal hexagonal close packing, c/a = √(8/3), fills the same π/(3√2) = 0.740480490, from a
      different cell and a basis of two.
    readout: packing fraction, enumerated
    expect: { value: 0.74048049, tolerance: 1.0e-9 }
    setup:
      params: { lattice: hcp }
  - id: bcc-coordination
    statement: The body-centred cubic lattice gives each atom 8 nearest neighbours.
    readout: nearest neighbours (coordination number)
    expect: { value: 8, tolerance: 0 }
    setup:
      params: { lattice: bcc }
  - id: bcc-packing
    statement: Spheres touching along the body diagonal fill π√3/8 = 0.680174762 of space.
    readout: packing fraction, enumerated
    expect: { value: 0.680174762, tolerance: 1.0e-9 }
    setup:
      params: { lattice: bcc }
  - id: sc-packing
    statement: On the simple cubic lattice they fill π/6 = 0.523598776.
    readout: packing fraction, enumerated
    expect: { value: 0.523598776, tolerance: 1.0e-9 }
    setup:
      params: { lattice: sc }
  - id: diamond-coordination
    statement: The diamond structure gives each atom 4 nearest neighbours, a tetrahedron.
    readout: nearest neighbours (coordination number)
    expect: { value: 4, tolerance: 0 }
    setup:
      params: { lattice: diamond }
  - id: diamond-nearest
    statement: Its nearest neighbours lie a quarter of the cube's body diagonal away, √3/4 = 0.433012702 a.
    readout: nearest-neighbour distance
    expect: { value: 0.433012702, tolerance: 1.0e-9 }
    setup:
      params: { lattice: diamond }
---

One atom of a crystal and its neighbours, shell by shell, in the five commonest ways of stacking spheres.

A crystal is a lattice, three primitive vectors repeated, with a basis of one or more atoms at every point. Simple cubic puts one atom at the corner of each cube; body-centred cubic adds one at the cube's centre; face-centred cubic one at each face's centre. Hexagonal close packing stacks layers of touching spheres so that every third layer lies over the first, and diamond places a second face-centred lattice a quarter of the way along the body diagonal of the first.

The plate builds each lattice from its vectors and basis, lists every point within four cells of an atom, and sorts them by distance into shells: the first shell's size is the coordination number. Spheres as large as the first shell allows, touching their nearest neighbours, fill a fraction of space found from that distance and the cell's volume; the readouts compare it with the closed form each geometry gives, π/(3√2) for the two close packings, π√3/8, π/6 and π√3/16.

**A still.** Nothing in the picture moves: a lattice is a geometry, not a process, so the diagram is redrawn when a control changes and every readout is computed from the controls alone. The state travels in the URL.

**Data.** The plate takes no data of a reader's: its inputs are a choice and three sliders, and a crystal's structure file is not among the kinds ADR 0010 can read.
