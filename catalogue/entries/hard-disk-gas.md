---
id: hard-disk-gas
title: Hard-Disk Gas
taxonomy: physics/statistical
status: live
engine: custom
schema: algoglyph.entry/v2
sources:
  - id: feynman-lectures
    ref: 'Vol. I, ch. 39 (the kinetic theory of gases), ch. 40 (the principles of statistical mechanics), ch. 43 (diffusion: the mean free path)'
    purpose: further-reading
  - id: alder-wainwright-1959
    purpose: algorithm-reference
  - id: sedgewick-2011
    ref: 'Section 6.1, event-driven simulation'
    purpose: implementation
  - id: henderson-1975
    purpose: further-reading
tags:
  - kinetic theory
  - ideal gas law
  - Maxwell–Boltzmann distribution
  - equipartition
  - mean free path
  - event-driven simulation
complexity: O(N) per collision (every disk's next meeting is predicted), at most a counted budget of predictions a frame
interaction: Choose the number of disks, how tightly they are packed, how many are heavy and how much heavier, the temperature, the run's length and how they start; or attach your own table of disks.
motivation: Nothing but disks bouncing off each other and the walls, and out come the gas laws, the distribution of molecular speeds, the equal sharing of energy between light and heavy molecules and the distance a molecule flies between collisions.
relations:
  - type: uses
    target: binary-heap
    reason: Each disk's predicted next collision waits in a binary heap keyed by its time; the earliest is taken from the top, and a stale one is predicted again.
  - type: uses
    target: box-muller
    reason: The start in Maxwell's distribution draws each velocity component by the Box–Muller transform of the seeded generator.
  - type: compares_with
    target: brownian-walkers
    reason: The same heat bath from two ends; here the collisions themselves are simulated, there only their effect, as friction and random kicks tied by Einstein's relation.
  - type: related_to
    target: ising-model
    reason: Another way to reach the Boltzmann distribution, there by Metropolis flips on a lattice, here by Newton's laws and collisions alone.
pedagogy:
  difficulty: introductory
  objectives:
    - See the pressure on the walls come out of the momentum the disks deliver, and match NkT/A when the disks are small and far apart.
    - Watch speeds that all start equal spread into the two-dimensional Maxwell law, Rayleigh's distribution, within a few collisions per disk.
    - See light and heavy disks end up with the same mean kinetic energy, kT, though they started with energies in the ratio of their masses.
    - Measure the mean free path and compare it with 1/(√2 nσ) and with Enskog's correction for a dense gas.
  misconceptions:
    - Heavy molecules are not slower because they have less energy; they have the same mean kinetic energy and are slower because they are heavier.
    - The pressure of a dilute gas does not depend on what the molecules are made of, only on how many there are, the temperature and the area.
    - A molecule does not fly the mean free path between every pair of collisions; free paths are spread out, exponentially, around their mean.
  questions:
    - Why does the measured pressure sit slightly above NkT/A even at low density, and by how much should it?
    - If every disk starts at the same speed, what does a single collision do to the distribution, and why does it take only a few to reach Rayleigh's law?
    - How does the mean free path change if the disks are made twice as large at the same number?
algorithm:
  paradigm: simulation
  properties:
    deterministic: true
  preconditions:
    - The disks start without overlapping; the lattice start guarantees it at every packing fraction the control allows.
  limitations:
    - The box has hard walls, so the disks near a wall see fewer neighbours; the effects shrink as the disks get smaller than the box.
    - Two dimensions only; the cross-section of a disk is a length, 2d, where a sphere's is an area.
    - A frame predicts at most a fixed number of meetings, so a dense or hot gas runs its time steps more slowly, never with less care.
experiments:
  - id: dilute
    title: A dilute gas
    params: { eta: 0.005, n: 400 }
    observe: The pressure meets NkT/A to within a percent, and the free path meets 1/(√2 nσ).
  - id: dense
    title: A dense fluid
    params: { eta: 0.4, n: 300 }
    observe: The pressure is several times the ideal gas's and the free path is much shorter than 1/(√2 nσ), both close to Henderson's and Enskog's dense-gas forms.
  - id: one-speed
    title: All at one speed
    params: { start: equal, heavy: 0 }
    observe: A spike of equal speeds spreads into Rayleigh's law within a few collisions per disk.
  - id: very-unequal
    title: Very unequal masses
    params: { ratio: 16, heavy: 0.3 }
    observe: The heavy disks' energy, sixteen times the light ones' at the start, falls to the same kT.
claims:
  - id: ideal-gas-law
    statement: >-
      Four hundred disks of one mass at packing fraction 0.005 press on their walls with PA/NkT equal to
      the ideal gas's 1 raised by the second virial coefficient, 1 + 2η, within 0.0023: four standard
      deviations of the reading over the calibration seeds 101–130, plus the two readouts' rounding, at
      every seed of 1–5.
    readout: PA/NkT, measured at the walls
    expect: { against: 'second virial, 1 + 2η', tolerance: 0.0023 }
    setup:
      params: { eta: 0.005, n: 400, run: 200, heavy: 0 }
      seeds: [1, 2, 3, 4, 5]
  - id: dense-fluid-pressure
    statement: >-
      At packing fraction 0.3 the pressure is Henderson's equation of state for hard disks, not the
      dilute gas's: PA/NkT is within 0.070 of (1 + η²/8)/(1 − η)², which is four standard deviations of
      the reading over the calibration seeds 101–130 (0.049) plus the hard walls' finite-size offset
      measured on the same seeds (0.021), at every seed of 1–5; the second virial's 1 + 2η is 0.46 away.
    readout: PA/NkT, measured at the walls
    expect: { against: 'Henderson’s equation of state, (1 + η²/8)/(1 − η)²', tolerance: 0.07 }
    setup:
      params: { eta: 0.3, n: 400, run: 100, heavy: 0 }
      seeds: [1, 2, 3, 4, 5]
  - id: rayleigh-speeds
    statement: >-
      Started all at one speed, light and heavy together, the disks' speeds follow Rayleigh's law after
      twenty free times: the Kolmogorov–Smirnov distance of m v²/2kT from the exponential law is below
      0.0682, the mean plus four standard deviations of the distance over the calibration seeds 101–130,
      at every seed of 1–5.
    readout: KS distance of the speeds from Rayleigh’s law
    expect: { below: 0.0682 }
    setup:
      params: { n: 400, run: 20 }
      seeds: [1, 2, 3, 4, 5]
  - id: equipartition
    statement: >-
      Heavy disks four times the mass of the light ones start with four times their energy and end with
      the same mean kinetic energy: the ratio, averaged over the second half of the run, is 1 within
      0.053, four standard deviations over the calibration seeds 101–130, at every seed of 1–5.
    readout: mean kinetic energy, heavy over light
    expect: { value: 1, tolerance: 0.053 }
    setup:
      params: { n: 600, run: 200 }
      seeds: [1, 2, 3, 4, 5]
  - id: mean-free-path
    statement: >-
      In a dilute gas of one mass the distance flown per collision is kinetic theory's 1/(√2 nσ), with
      Enskog's dense-gas factor χ, within 0.0262 of the ratio: four standard deviations over the
      calibration seeds 101–130, plus rounding, at every seed of 1–5.
    readout: mean free path over 1/(√2 nσ), σ = 2d
    expect: { against: 'Enskog’s free path for these masses, χ = (1 − 7η/16)/(1 − η)²', tolerance: 0.0262 }
    setup:
      params: { eta: 0.005, n: 400, run: 200, heavy: 0 }
      seeds: [1, 2, 3, 4, 5]
  - id: energy-kept
    statement: >-
      Numerics: elastic collisions and bounces keep the kinetic energy to round-off, a relative change
      below 10⁻¹² over two hundred free times of six hundred disks.
    readout: energy drift |ΔE|/E (numerics)
    expect: { below: 1.0e-12 }
    setup:
      params: { n: 600, run: 200 }
data:
  - id: disks
    title: Your disks
    kind: table
    accepts: [csv, json]
    columns:
      - { key: x, unit: 'box side', min: 0, max: 1 }
      - { key: y, unit: 'box side', min: 0, max: 1 }
      - { key: vx, unit: 'speed (box sides per time)', min: -10, max: 10 }
      - { key: vy, unit: 'speed (box sides per time)', min: -10, max: 10 }
      - { key: m, unit: 'mass (light disk = 1)', min: 0.1, max: 100 }
    rows: { min: 2, max: 600 }
    bytes: 32768
    replaces: start
    ignores: [n, heavy, ratio, kT]
    url_bytes: 1800
    note: Each row is a disk at (x, y) in the unit box with velocity (vx, vy) and mass m; all of them get the diameter that gives their number the packing fraction chosen, a row overlapping one already placed is left out, and the temperature is their own mean kinetic energy.
---

Disks in a box with hard walls, flying straight and bouncing elastically off each other and the walls; every collision is found exactly, and the gas laws come out of nothing else.

**The method.** Between collisions every disk moves in a straight line, so nothing has to be stepped: the time at which two disks touch is the root of a quadratic, and the time at which a disk reaches a wall is a division. Each disk keeps its one predicted next event, and the predictions wait in a binary heap keyed by time (the structure of #/p/binary-heap). The earliest is taken off the top; if either disk has collided since it was predicted it is stale, and that disk's next event is predicted again. Otherwise the two disks exchange momentum along the line of their centres, which keeps both momentum and kinetic energy, and the disks involved are predicted afresh against every other. A prediction is never later than the true next event, so a stale one only costs a second look. This is Alder and Wainwright's event-driven molecular dynamics.

**What is measured.** Nothing in the plate knows a gas law. The walls add up the momentum 2m|v⊥| each bounce delivers; divided by the time and by the length of wall the centres reach, that is the pressure. The disks add up the distance they fly and count their collisions; their ratio, with two free paths ended at every collision, is the mean free path. The kinetic energies of the light and the heavy disks are averaged over the second half of the run, after the start has relaxed, and every average is quoted with the standard error of ten blocks of that half.

**The ideal gas.** A dilute gas presses on its walls with P = NkT/A, kT being the mean kinetic energy per disk (½kT for each of the two directions). Disks of diameter d exclude a little of the area from each other, which raises the pressure by the second virial coefficient: PA/NkT = 1 + 2η at low packing fraction η. Henderson's equation of state, (1 + η²/8)/(1 − η)², carries it into the dense fluid.

**Maxwell's speeds.** In two dimensions the speeds of a gas in equilibrium follow Rayleigh's law, f(v) = (mv/kT)·e^(−mv²/2kT); equivalently m v²/2kT is exponential with mean 1 for every disk whatever its mass, and the plate tests that by the Kolmogorov–Smirnov distance. The histogram scales each speed by its own mass, so light and heavy disks fall on one curve. Started with every disk at the same speed, the spike spreads into the law within a few collisions per disk.

**Equipartition.** Started at one speed, the heavy disks have the larger energy, in the ratio of the masses. Collisions trade energy until both kinds have the same mean, kT, though the heavy ones then move more slowly; the chart shows the two means meeting.

**The free path.** A disk sweeps a strip of width 2d, so in two dimensions its cross-section is the length σ = 2d. Against disks moving with their own Maxwellian speeds, the relative speed is √2 times larger on average, and the mean free path is 1/(√2 nσ). In a dense gas collisions come faster by the pair correlation at contact, χ, which Enskog's theory puts into the collision rate; with Henderson's χ = (1 − 7η/16)/(1 − η)² the free path is 1/(√2 nσχ).

**Your disks.** A table of positions (in the unit box), velocities and masses is run exactly as the seeded start, at the diameter the packing fraction gives for its number of rows; a row whose disk would overlap one already placed is left out and counted. The table stays in the browser. The same heat bath, with the collisions replaced by friction and random kicks, is #/p/brownian-walkers.
