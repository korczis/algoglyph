---
id: scales-atlas
title: An Atlas of the Scales the Constants Set
taxonomy: physics/mechanics
status: live
engine: custom
schema: algoglyph.entry/v2
aliases:
  - orders of magnitude
  - powers of ten
  - Bohr radius
  - Planck length
  - natural units
sources:
  - id: feynman-lectures
    ref: 'Vol. I, ch. 5 (time and distance: from the nucleus to the universe, from the shortest times to the age of the earth)'
    purpose: further-reading
  - id: codata-2018
    ref: 'the recommended values of h, c, m_e, α and G, and of the Bohr radius, the Compton wavelength, the classical electron radius, R∞, the atomic unit of time and the Planck length and time'
    purpose: data
tags:
  - orders of magnitude
  - constants
  - atomic units
  - Planck units
  - logarithmic scale
complexity: O(12) per change
interaction: Choose lengths or times; the sliders set the window of the ruler, in decades.
motivation: Every length an atom has comes out of ħ, the electron's mass, c and α, and seeing them on one ruler shows how far apart the fine-structure constant spaces them.
relations:
  - type: related_to
    target: bound-states
    reason: The Bohr radius and the Rydberg energy that set this ruler's atomic rungs are what the bound-state solver finds as hydrogen's ground state, there from the Schrödinger equation on a grid.
  - type: related_to
    target: roots-and-logarithms
    reason: The ruler places every rung at its logarithm, so a factor becomes a distance; the Planck length's square root and the atomic rungs' powers of α turn into halving and equal steps.
pedagogy:
  difficulty: introductory
  objectives:
  - Place the Planck length, the classical electron radius, the Compton wavelength and the Bohr radius on one logarithmic ruler.
  - See that each atomic rung is the one before divided by α, 1/137.
  - Derive a light-year from the speed of light and the Julian year, exactly.
  misconceptions:
  - The electron is not a ball of the classical electron radius; that length is where its field's energy would equal its rest energy, a scale and not a size.
  - The Planck length is not a measured size of anything; it is where the constants of gravity and quantum mechanics meet.
  questions:
  - How many decades lie between the Planck length and the Bohr radius, and how many between the Bohr radius and a light-year?
  - Why is the classical electron radius α² times the Bohr radius?
algorithm:
  paradigm: transform
bounds:
  model: twelve closed forms of five constants
  worst: 'O(1) per change'
experiments:
  - id: atom
    title: The atom's ladder
    params: { lo: -16, hi: -6 }
    observe: The classical electron radius, the Compton wavelength and the Bohr radius are each 137 times the one before; Lyman α is 2300 Bohr radii.
  - id: planck
    title: The Planck scale
    params: { lo: -45, hi: -30 }
    observe: The Planck length is 20 decades below the classical electron radius.
  - id: atomic-times
    title: Atomic times
    params: { kind: time, lo: -20, hi: -15 }
    observe: Light crosses a Bohr radius in 0.18 attoseconds; the ground-state electron goes once around in 152 attoseconds, 2π/α times longer.
  - id: all-times
    title: From the Planck time to a year
    params: { kind: time, lo: -45, hi: 10 }
    observe: Fifty-one decades separate the Planck time from a Julian year.
  - id: cosmic
    title: A light-second to a light-year
    params: { lo: 7, hi: 17 }
    observe: The light-year is 31 557 600 light-seconds, a Julian year's seconds.
claims:
  - id: bohr-radius
    statement: >-
      ħ/(α m_e c) from CODATA 2018's h, c, m_e and α is its recommended Bohr radius,
      5.29177210903e−11 m: the adjusted values are consistent to the printed digits, within 1e−11
      relative, far inside the 1.5e−10 uncertainty.
    readout: Bohr radius against its tabled value
    expect: { below: 1.0e-11 }
  - id: compton-wavelength
    statement: >-
      ħ/(m_e c) is the reduced Compton wavelength 3.8615926796e−13 m within 1e−11 relative.
    readout: electron's reduced Compton wavelength against its tabled value
    expect: { below: 1.0e-11 }
  - id: classical-electron-radius
    statement: >-
      α ħ/(m_e c) = α² a₀ is the classical electron radius 2.8179403262e−15 m within 1e−11 relative.
    readout: classical electron radius against its tabled value
    expect: { below: 1.0e-11 }
  - id: lyman-alpha
    statement: >-
      4/(3R∞) with R∞ = α² m_e c/2h is 4/3 of the tabled R∞'s inverse, 121.502 nm (the infinitely
      heavy nucleus's Lyman α), within 1e−11 relative.
    readout: Lyman α, infinite nuclear mass against its tabled value
    expect: { below: 1.0e-11 }
  - id: atomic-time
    statement: >-
      ħ/E_h with E_h = α² m_e c² is the atomic unit of time 2.4188843265857e−17 s within 1e−11
      relative.
    readout: atomic unit of time against its tabled value
    expect: { below: 1.0e-11 }
  - id: planck-length
    statement: >-
      √(ħG/c³) is the Planck length 1.616255e−35 m within a tenth of its printed last digit, 1e−7
      relative (G is known to 2.2e−5).
    readout: Planck length against its tabled value
    expect: { below: 1.0e-7 }
  - id: planck-time
    statement: >-
      √(ħG/c⁵) is the Planck time 5.391247e−44 s within 2e−7 relative, a unit of the table's last
      digit, which rounds a value computed from G's unrounded estimate.
    readout: Planck time against its tabled value
    expect: { below: 2.0e-7 }
  - id: light-year
    statement: >-
      A light-year is c times the Julian year of 365.25 days of 86 400 s: 9 460 730 472 580 800 m
      exactly, an integer double precision holds.
    readout: light-year, in whole metres
    expect: { value: 9460730472580800, tolerance: 0 }
---

The lengths and times the constants of nature set, each computed from its formula and placed on one logarithmic ruler.

Five numbers fix the atom's scales: Planck's constant, the speed of light, the electron's mass, the fine-structure constant α ≈ 1/137 and, for the smallest rungs, Newton's G. The electron's reduced Compton wavelength is ħ/(m_e c); the Bohr radius, the size of hydrogen, is that divided by α; the classical electron radius is it multiplied by α. One factor of α separates each rung from the next. Hydrogen's first ultraviolet line, Lyman α, is 4/3 of the inverse Rydberg constant, and the atomic unit of time is the time an electron's phase takes to turn by one radian in the Hartree energy. Gravity's constant joins them only at the Planck length, twenty decades below the classical electron radius.

Each rung is computed from the constants every time the plate is drawn; the readouts compare it with CODATA's recommended value, which the plate does not compute. The atomic rungs agree to the printed digits, since CODATA adjusts all its values together; the Planck rungs agree to the table's last printed digit.

**A still.** Nothing in the picture moves: a ruler of constants has no time in it, so the diagram is redrawn when a control changes and every readout is computed from the constants alone. The state travels in the URL.

**Data.** The plate takes no data of a reader's: its inputs are a choice and two sliders, and a table of lengths is not among the kinds ADR 0010 can read.
