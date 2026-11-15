---
id: self-energy
title: The Energy of a Charged Ball, and the Point Electron
taxonomy: physics/electrostatics
status: live
engine: custom
schema: algoglyph.entry/v2
sources:
  - id: feynman-lectures
    ref: 'Vol. II, ch. 8 (electrostatic energy), ch. 28 (electromagnetic mass)'
    purpose: further-reading
  - id: jackson-1999
    ref: 'Ch. 16, self-fields and radiation reaction'
    purpose: further-reading
  - id: codata-2018
    purpose: data
tags:
  - electrostatic energy
  - self-energy
  - electromagnetic mass
  - classical electron radius
  - Monte Carlo
  - Gaussian quadrature
complexity: O(quadrature nodes) for the integrals; O(N²) for the pair sum, spread over frames
interaction: Choose how the charge sits in the ball, its profile's power, and how many points the pair sum draws; or attach your own radial profile ρ(r).
motivation: Packing charge into a ball costs energy, and the smaller the ball the more; for a point it is infinite, which is the oldest crack in classical electrodynamics and the reason the electron cannot be a little charged ball.
relations:
  - type: related_to
    target: charges-and-field-lines
    reason: The field inside and outside the ball is Gauss's law, which that plate checks as a flux through a sphere.
  - type: related_to
    target: four-vectors
    reason: A moving ball's field carries momentum 4/3 of its energy over c², not the 1 relativity asks of a four-vector; the missing stresses are what that plate's invariant mass would need.
  - type: related_to
    target: barnes-hut
    reason: The same sum of 1/r over every pair of points; there a tree approximates it for gravity, here it is done in full as one of three routes to the energy.
pedagogy:
  difficulty: intermediate
  objectives:
    - Compute the energy of a charge distribution as the energy of its field, ∫½ε₀E² dV.
    - Compute it again as the work of assembling the charge shell by shell from infinity, and a third time from the pairs of many point charges.
    - See that the energy grows as the charge is pushed outwards, from 3/5 for an even ball to 1/2 for a shell, in units of Q²/4πε₀R, and that the field outside always holds 1/2.
    - Find the field momentum of a moving ball and meet the 4/3 problem, and the classical electron radius.
  misconceptions:
    - The energy is not stored in the charges but in the field; for a shell all of it lies outside the shell.
    - A shell does not have less energy than an even ball because it holds less charge; the same charge further out means less field inside, none at all for the shell.
    - The pair sum of N point charges is not the continuum's energy; it misses each point's own infinite self-energy, which is why it is divided by 1 − 1/N.
  questions:
    - Why does the share of the energy outside the ball go from 5/6 for an even ball to all of it for a shell?
    - If the electron were a shell whose field energy were its rest energy, how large would it be, and why is the answer smaller than the classical radius?
    - The field momentum is 4/3 of U v/c². What would have to hold the charge together to bring it back to 1?
algorithm:
  paradigm: numerical-integration
  properties:
    deterministic: true
  preconditions:
    - The density is spherically symmetric and zero outside the ball.
  limitations:
    - 'Classical and static: the electron is not a ball of charge, and quantum electrodynamics replaces the self-energy by a renormalised mass.'
    - The pair sum is a Monte Carlo estimate; its scatter falls as 1/N, slowly enough that the readout is a check of the integrals, not a rival to them.
experiments:
  - id: even-ball
    title: An even ball
    params: { profile: uniform }
    observe: All three energies are 3/5 of Q²/4πε₀R, and five sixths of the energy lies outside the ball.
  - id: pushed-out
    title: Charge pushed outwards
    params: { profile: power, k: 8 }
    observe: The energy falls towards the shell's 1/2 as the charge crowds to the surface.
  - id: shell
    title: A shell
    params: { profile: shell }
    observe: The field inside is zero and the energy is 1/2; the field momentum is still 4/3 of U v/c².
claims:
  - id: even-ball-three-fifths
    statement: >-
      The field energy of an even ball, integrated over all space, is 3/5 of Q²/4πε₀R within 10⁻⁸.
    readout: energy of the field ∫½ε₀E² dV, in Q²/4πε₀R
    expect: { against: 'closed form (k + 3)/(2k + 5), ½ for a shell', tolerance: 1.0e-8 }
    setup:
      params: { profile: uniform }
  - id: assembly-is-the-field-energy
    statement: >-
      For ρ ∝ r², the work of assembling the ball shell by shell from infinity equals the energy of its
      field within 10⁻⁸, two different integrals of the same charge.
    readout: work of assembling it shell by shell, ∫Q dQ/4πε₀r
    expect: { against: 'energy of the field ∫½ε₀E² dV, in Q²/4πε₀R', tolerance: 1.0e-8 }
    setup:
      params: { profile: power, k: 2 }
  - id: power-law-closed-form
    statement: >-
      For ρ ∝ r², the field energy is (k + 3)/(2k + 5) = 5/9 of Q²/4πε₀R within 10⁻⁸.
    readout: energy of the field ∫½ε₀E² dV, in Q²/4πε₀R
    expect: { against: 'closed form (k + 3)/(2k + 5), ½ for a shell', tolerance: 1.0e-8 }
    setup:
      params: { profile: power, k: 2 }
  - id: shell-one-half
    statement: >-
      A thin shell's energy is 1/2 of Q²/4πε₀R within 10⁻⁸, all of it in the field outside.
    readout: energy of the field ∫½ε₀E² dV, in Q²/4πε₀R
    expect: { value: 0.5, tolerance: 1.0e-8 }
    setup:
      params: { profile: shell }
  - id: pairs-of-points
    statement: >-
      Two thousand points drawn from an even ball, each carrying Q/N, have a pair energy that, divided
      by 1 − 1/N, is 3/5 within 0.0112: four standard deviations of the estimate over the calibration
      seeds 101–130, at every seed of 1–5.
    readout: pairs of N points, ½Σqᵢqⱼ/4πε₀rᵢⱼ ÷ (1 − 1/N)
    expect: { value: 0.6, tolerance: 0.0112 }
    setup:
      params: { profile: uniform, points: 2000 }
      seeds: [1, 2, 3, 4, 5]
  - id: four-thirds
    statement: >-
      The momentum of the field of a slowly moving ball with ρ ∝ r², integrated over r and θ, is 4/3
      of U v/c² within 10⁻⁸; the electromagnetic mass is not U/c².
    readout: field momentum over U v/c², ∫ε₀E×B dV by quadrature
    expect: { value: 1.333333333, tolerance: 1.0e-8 }
    setup:
      params: { profile: power, k: 2 }
  - id: classical-electron-radius
    statement: >-
      The classical electron radius computed from CODATA 2018's e, ε₀, mₑ and c is CODATA's own rₑ,
      2.8179403262 fm, to the ten decimals printed.
    readout: classical electron radius e²/4πε₀mₑc², fm (CODATA 2018 e, ε₀, mₑ, c)
    expect: { against: 'CODATA 2018 rₑ, fm', tolerance: 2.0e-10 }
data:
  - id: profile
    title: Your charge profile
    kind: table
    accepts: [csv, json]
    columns:
      - { key: r, unit: 'radius (the ball is 1)', min: 0, max: 1 }
      - { key: rho, unit: 'charge density (any unit; the total is scaled to Q)', min: 0, max: 1000000 }
    rows: { min: 2, max: 512 }
    bytes: 16384
    replaces: profile
    ignores: [k]
    url_bytes: 1800
    note: The density is taken as a straight line between the rows, sorted by radius, and zero beyond the last; it is scaled so the ball holds the charge Q, and its energy is then computed the three ways.
---

The energy it takes to pack a charge Q into a ball of radius R, worked out three independent ways, and what it says about a point electron.

**Three routes to one number.** The units are ε₀ = 1, Q = 1 and R = 1, and the energies are printed in Q²/4πε₀R. The charge's density ρ(r) is integrated into the charge inside every radius, Q(r), by Gauss–Legendre quadrature, and Gauss's law gives the field E = Q(r)/4πε₀r². First, the energy of the field: ½ε₀E² integrated over all of space, inside the ball by quadrature in r and outside by the same quadrature after r = R/u brings infinity to u = 0. Second, the work of assembly: charge brought in from infinity onto a ball of radius r already holding Q(r) costs Q(r) dQ/4πε₀r, integrated from the centre out. Third, without any field at all: N points drawn from ρ, each carrying Q/N, and the sum of q²/4πε₀rᵢⱼ over every pair, divided by 1 − 1/N because N points have only N(N − 1)/2 pairs where the continuum counts N²/2. The first two agree to the quadrature's accuracy, the third to its Monte Carlo scatter, and all three with the closed form (k + 3)/(2k + 5) for a density ∝ rᵏ, which is 3/5 for an even ball and 1/2 for a shell.

**Where the energy is.** Outside the ball the field is that of a point charge whatever the profile, and holds Q²/8πε₀R, half a unit; the rest is inside. An even ball keeps a sixth of its energy inside, a shell none. The chart draws E(r) and the share of the energy inside r, out to three radii.

**The 4/3 problem.** Moving slowly at v, the ball carries a magnetic field v × E/c², and the field carries momentum ε₀E × B. Integrated over r and over the angle θ to the motion, it is (4/3)U v/c², whatever the profile: an electromagnetic mass of 4/3 of its energy over c², where relativity wants exactly 1. The difference is the work of whatever holds the charge together against its own repulsion, which a purely electromagnetic electron lacks.

**The point electron.** If the electron's rest energy mₑc² were all field energy, it would have to be a ball of radius about the classical electron radius rₑ = e²/4πε₀mₑc², a few femtometres: half of rₑ for a shell, 3/5 of it for an even ball. As the radius goes to zero the energy goes to infinity. The radiation reaction time 2rₑ/3c, the time light takes to cross a classical electron, is where the classical theory of its self-force stops making sense. The plate computes rₑ from CODATA 2018's constants and prints CODATA's own value beside it.

**Your profile.** A table of (r, ρ) points defines a density that is straight between them and zero beyond the last; it is scaled to hold Q, and its energy is computed the three ways. The table stays in the browser.
