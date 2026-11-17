---
id: semiconductors
title: A p-n Junction in Equilibrium
taxonomy: physics/electrostatics
status: live
engine: custom
schema: algoglyph.entry/v2
aliases:
  - built-in potential
  - Poisson–Boltzmann equation
  - depletion region
  - band bending
sources:
  - id: feynman-lectures
    ref: 'Vol. III, ch. 14 (semiconductors: electrons and holes, impurities, the junction)'
    purpose: further-reading
  - id: sze-ng-2007
    ref: 'Ch. 1 (effective densities of states and band gaps at 300 K, Appendix G) and ch. 2 (the abrupt junction in equilibrium)'
    purpose: data
tags:
  - semiconductors
  - p-n junction
  - Newton's method
  - band diagram
complexity: O(nodes × Newton steps), a tridiagonal solve per step; nodes from the Debye lengths, up to about 5,300
interaction: The menu picks the material; the sliders set the two dopings and the temperature.
motivation: Put p-type and n-type silicon together and the bands bend until the Fermi level is flat; how far they bend is fixed by neutrality far away, and the plate finds it by solving for the potential everywhere.
relations:
  - type: compares_with
    target: poisson-grid
    reason: Both solve Poisson's equation on a grid; there the charge is given, here it follows the potential through Boltzmann's factor, so the equation is nonlinear and is solved by Newton's method.
  - type: uses
    target: gaussian-elimination
    reason: Each Newton step solves a tridiagonal system by the Thomas algorithm, Gaussian elimination without pivoting on a band three wide, in time linear in the nodes.
pedagogy:
  difficulty: advanced
  objectives:
  - Write the charge of a junction as holes minus electrons plus donors minus acceptors, the carriers following the potential by Boltzmann's factor.
  - See that zero field far away forces neutrality there, and that neutrality alone fixes the built-in potential (kT/q)·ln(N_A·N_D/n_i²).
  - Read the field at the junction from the equation's first integral, without solving it, and compare with the grid's.
  misconceptions:
  - The built-in potential cannot drive a current or be read with a voltmeter; it is what makes the Fermi level flat in equilibrium.
algorithm:
  paradigm: iterative-refinement
bounds:
  model: Newton steps on a tridiagonal system
  worst: 'O(nodes) per step; at most 200 steps, each update capped at one kT/q; under 60 at every corner of the controls'
experiments:
  - id: one-sided
    title: A one-sided junction
    params: { na: 15, nd: 18 }
    observe: The lightly doped p side carries almost all of the depletion region, a thousand times wider than on the n side, and the bands bend there.
  - id: symmetric
    title: Equal dopings
    params: { na: 16.5, nd: 16.5 }
    observe: The depletion region splits evenly and the space charge is an odd step about the junction.
  - id: hot
    title: A hot junction
    params: { t: 500 }
    observe: At 500 K the intrinsic density rises ten thousandfold, the built-in potential falls to about 0.51 V, and the Debye tails lengthen.
  - id: germanium
    title: Germanium
    params: { material: ge }
    observe: The narrow 0.66 eV gap makes n_i three thousand times silicon's, and the built-in potential is under half of silicon's at the same dopings.
  - id: gallium-arsenide
    title: Gallium arsenide
    params: { material: gaas }
    observe: The wide gap gives the largest built-in potential, about 1.21 V, and the steepest field at the junction.
claims:
  - id: drop-is-neutrality
    statement: >-
      With zero field at both ends, the solved potential settles far from the junction to whatever
      makes the charge vanish there, so the drop across is the neutrality closed form
      (kT/q)·(asinh(N_D/2n_i) + asinh(N_A/2n_i)), which no grid computes. Thirty Debye lengths of
      neutral material leave e^(−30) ≈ 1e−13 of kT/q, so they agree within 1e−12 V.
    readout: solved drop against neutrality
    expect: { below: 1.0e-12 }
  - id: drop-is-neutrality-one-sided-and-cold
    statement: >-
      At the heaviest corner of the controls, N_A = 1e15 against N_D = 1e18 at 200 K, the grid has
      over 5,000 nodes and Newton takes the most steps; the drop still agrees within 1e−12 V.
    readout: solved drop against neutrality
    expect: { below: 1.0e-12 }
    setup:
      params: { na: 15, nd: 18, t: 200 }
  - id: drop-is-neutrality-germanium
    statement: >-
      In germanium, n_i = 2.3e13 cm⁻³ is close enough to the dopings that asinh and the logarithm
      differ in the seventh digit; the solved drop follows asinh, within 1e−12 V.
    readout: solved drop against neutrality
    expect: { below: 1.0e-12 }
    setup:
      params: { material: ge }
  - id: built-in-potential-of-silicon
    statement: >-
      Silicon at 300 K, from the tabled N_c = 2.8e19, N_v = 1.04e19 cm⁻³ and E_g = 1.12 eV, has
      n_i = 6.676e9 cm⁻³, and with N_A = 1e16, N_D = 1e17 the textbook (kT/q)·ln(N_A·N_D/n_i²) is
      0.794736 V: the solved drop matches it within 1e−6 V.
    readout: potential drop, solved
    expect: { value: 0.794736, tolerance: 0.000001 }
  - id: junction-field-is-the-first-integral
    statement: >-
      Multiplying the equation by u' and integrating from the neutral sides gives the field at the
      junction in closed form, without the grid. The grid's central difference, less its known
      leading error at the step in the doping, converges to it at second order; at four nodes per
      Debye length of the heavier side it is within 2.5e−4.
    readout: solved field against the first integral, relative
    expect: { below: 2.5e-4 }
  - id: junction-field-gallium-arsenide
    statement: >-
      In gallium arsenide with N_A = 1e16 and N_D = 1e17 the field is 1.1e5 V/cm, and the grid's is
      within 8e−5 of the first integral's.
    readout: solved field against the first integral, relative
    expect: { below: 8.0e-5 }
    setup:
      params: { material: gaas }
  - id: junction-field-one-sided-and-cold
    statement: >-
      At the heaviest corner the field changes fastest across the heavily doped side's 3 nm Debye
      length; the grid's is within 3e−3 of the first integral's.
    readout: solved field against the first integral, relative
    expect: { below: 3.0e-3 }
    setup:
      params: { na: 15, nd: 18, t: 200 }
---

A p-n junction in thermal equilibrium: the bands bend across it until the Fermi level is flat, and the plate solves for the potential everywhere.

Holes on the p side and electrons on the n side spill across the junction and annihilate, leaving the fixed acceptor and donor ions behind: a space charge, negative on the p side and positive on the n side, whose field holds the remaining carriers back. In equilibrium the carrier densities follow the potential by Boltzmann's factor, n = n_i·e^(qψ/kT) and p = n_i·e^(−qψ/kT), so Poisson's equation becomes nonlinear in ψ: the Poisson–Boltzmann equation. The plate solves it on a grid by Newton's method, a tridiagonal system per step, with zero field at both ends, so the potential far into each side is found rather than imposed.

Two closed forms check the solution without solving it. Far from the junction the charge must vanish, which fixes the potential there to asinh(N/2n_i) in units of kT/q, and so the drop across, the built-in potential, is (kT/q)·(asinh(N_D/2n_i) + asinh(N_A/2n_i)), the familiar (kT/q)·ln(N_A·N_D/n_i²) when the dopings are far above n_i. And the equation has a first integral: multiplied by ψ' it integrates from the neutral side to give the field at any potential, so the field at the junction follows from one linear equation. The grid's field converges to it at second order once the central difference is corrected for the step in the doping.

**A still.** Nothing moves in thermal equilibrium; the junction is solved once when a control changes and drawn as it stands: the band diagram above, the space charge below. The band gap is held at its 300 K value at every temperature, and the effective densities of states scale as T^(3/2).

**Data.** The plate takes no data of a reader's: a measured doping profile would be a table, but this plate solves only abrupt junctions; reading one waits on the per-engine upload slices.
