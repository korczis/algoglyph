---
id: rate-processes
title: Rate Processes
taxonomy: physics/statistical
status: live
engine: custom
schema: algoglyph.entry/v2
aliases:
  - Gillespie algorithm
  - radioactive decay chain
  - Bateman equations
  - Einstein coefficients
  - Planck distribution
  - Bose–Einstein statistics
  - Fermi–Dirac statistics
sources:
  - id: feynman-lectures
    ref: 'Vol. I, ch. 42 (applications of kinetic theory: Einstein''s laws of radiation, emission and absorption at rates that give Planck''s law); Vol. III, ch. 4 (identical particles: the boson and fermion rules)'
    purpose: further-reading
  - id: gillespie-1977
    purpose: implementation
  - id: bateman-1910
    purpose: implementation
  - id: einstein-1917
    purpose: further-reading
tags:
  - stochastic simulation
  - Gillespie algorithm
  - continuous-time Markov chain
  - radioactive decay
  - detailed balance
  - Planck's law
  - Bose–Einstein statistics
  - Fermi–Dirac statistics
complexity: O(changes × reactions) for Gillespie's direct method; up to 400 000 changes a run
interaction: Choose the process; for the chain, the atoms and the two half-lives; for Einstein's atoms, their number and hν/kT; for the level, the kind of particle and (ε − μ)/kT.
motivation: Many laws of physics are averages over changes that happen at random, each at a rate; run the changes one at a time and the averages appear, from Bateman's chain of decays to Planck's law of radiation, which Einstein found from nothing more than the rates of absorption and emission.
relations:
  - type: related_to
    target: ising-model
    reason: Both sample a Boltzmann distribution by a Markov chain that satisfies detailed balance; there Metropolis flips spins in discrete steps, here Gillespie's method runs changes in continuous time.
  - type: related_to
    target: brownian-walkers
    reason: Both turn rates of random events into averages; there the walkers' spread grows as √t, here a population's counts settle to the occupancies the rates imply.
  - type: related_to
    target: hard-disk-gas
    reason: Both are event-driven and exact, with no time step; there the next event is the earliest collision, here the next change of a population at a random time.
  - type: related_to
    target: pert-monte-carlo
    reason: Both turn random durations into the averages a reader asks about; there a project's task times drawn run by run, here exponential waiting times drawn change by change.
pedagogy:
  difficulty: intermediate
  objectives:
    - Run a decay chain A → B → C atom by atom and match B's share at its peak time to Bateman's solution, within its binomial spread.
    - See that atoms whose excitation and de-excitation follow Einstein's rates leave one mode of light with Planck's mean occupancy 1/(e^(hν/kT) − 1).
    - Find the Bose–Einstein, Fermi–Dirac and Boltzmann means of one level from the arrival rule alone, n + 1, 1 − n or 1.
    - Recognise the bosons' bunching in the variance n̄(1 + n̄), against a Poisson count's n̄.
  misconceptions:
    - A single atom's decay has no schedule; only the share decayed after a time is predictable, and it scatters binomially about the closed form.
    - Planck's law does not need the photon to be put in by hand; stimulated emission, at the rate (n + 1), is what makes the mode's occupancy Planck's.
    - Fermions are not kept out of a level by a force; the rule is only that no second one can arrive, and the mean 1/(e^x + 1) follows.
  questions:
    - Why does B peak at ln(λ₂/λ₁)/(λ₂ − λ₁), and what happens when the two half-lives are equal?
    - What would the photon number's mean be if emission were only spontaneous, without the n?
    - Why does the bosons' level fluctuate more than the distinguishable particles' at the same mean?
    - When does a long-lived parent and short-lived daughter reach secular equilibrium, and what is the ratio then?
algorithm:
  paradigm: simulation
  properties:
    deterministic: false
  preconditions:
    - Every change is a Poisson process at a rate that depends only on the present counts; changes do not overlap.
    - Einstein's atoms have two levels, one mode of light with A = B, and collisions with a gas at temperature T at rates γe^(−hν/kT) up and γ down; γ = B = 1.
  invariants:
    - Gillespie's method samples the continuous-time Markov chain exactly; there is no time step to refine.
    - Time averages are integrals of the piecewise-constant counts, exact over the run; the first 50 time units are left out of them.
  limitations:
    - A run takes at most 400 000 changes; a boson level near x = 0, with a large mean, may reach that cap before its time is up, and the readout says when.
    - The chain is two decays long and starts from pure A; branching and longer chains are not modelled.
    - The plate takes no reader's data. Its inputs are rates and temperatures and its runs are seeded samples, so a reader's record of counts would call for a fit of rates rather than a run, the work of #/p/least-squares.
bounds:
  model: changes of the population (Gillespie steps), each choosing among the reactions
  best: Θ(changes · reactions)
  average: Θ(changes · reactions)
  worst: Θ(changes · reactions), at most 400 000 changes
  space: Θ(changes) for the kept history
experiments:
  - id: chain
    title: A decay chain
    params: { process: chain, halfA: 6, halfB: 2 }
    observe: B rises, peaks at 4.75 s with a fifth of the atoms, and falls as A runs out, following Bateman's curve within its binomial scatter.
  - id: secular-equilibrium
    title: A long-lived parent
    params: { process: chain, halfA: 20, halfB: 1 }
    observe: B settles at a twentieth of A, the ratio of the half-lives, and then falls with A.
  - id: equal-half-lives
    title: Equal half-lives
    params: { process: chain, halfA: 3, halfB: 3 }
    observe: B peaks at 1/λ, where λte^(−λt) is largest, with 1/e of the atoms.
  - id: planck-mode
    title: Einstein's atoms make Planck's law
    params: { process: einstein, N: 20, x: 1 }
    observe: The mode holds 0.58 photons on average, 1/(e − 1), and its photon number has the geometric distribution of a Bose–Einstein level.
  - id: hot-mode
    title: A hot mode
    params: { process: einstein, x: 0.2 }
    observe: At kT = 5hν the mode holds about 4.5 photons, close to the classical kT/hν − ½.
  - id: bosons
    title: Bosons in one level
    params: { process: level, stats: bose, x: 1 }
    observe: The level holds 1/(e − 1) particles on average and fluctuates by n̄(1 + n̄), more than a Poisson count.
  - id: fermions
    title: Fermions in one level
    params: { process: level, stats: fermi, x: 1 }
    observe: The level is occupied 27 per cent of the time, 1/(e + 1), and never twice.
  - id: distinguishable
    title: Distinguishable particles
    params: { process: level, stats: boltzmann, x: 1 }
    observe: The mean is e^(−1) and the variance equals it, the Poisson count of the classical limit.
claims:
  - id: bateman-peak
    statement: >-
      Of 5000 atoms of A (half-life 6 s) decaying through B (2 s), the share in B at B's peak time ln(λ₂/λ₁)/(λ₂ − λ₁)
      is Bateman's λ₁/(λ₂ − λ₁)(e^(−λ₁t) − e^(−λ₂t)) = 0.1925 within 0.023, four binomial standard deviations
      √(p(1 − p)/N₀), at every seed of 1–5; seeds 101–130 bear the band out.
    readout: share of B at the peak time, measured
    expect: { against: 'Bateman’s share of B there, λ₁/(λ₂ − λ₁)(e^(−λ₁t) − e^(−λ₂t))', tolerance: 0.023 }
    setup:
      seeds: [1, 2, 3, 4, 5]
  - id: half-life
    statement: >-
      After one half-life of A, half of it is left within 0.029, four binomial standard deviations, at every seed
      of 1–5.
    readout: share of A left after one half-life of A, measured
    expect: { against: 'share of A after one half-life, e^(−ln 2)', tolerance: 0.029 }
    setup:
      seeds: [1, 2, 3, 4, 5]
  - id: planck-occupancy
    statement: >-
      Twenty two-level atoms exchanging light with one mode by Einstein's rates, kept at hν/kT = 1 by collisions,
      leave the mode with Planck's mean occupancy 1/(e − 1) = 0.582 within 0.05 at every seed of 1–5; the band
      is four standard deviations of the time average over seeds 101–130.
    readout: photons in the mode, time average, measured
    expect: { against: 'Planck’s occupancy 1/(e^(hν/kT) − 1)', tolerance: 0.05 }
    setup:
      params: { process: einstein }
      seeds: [1, 2, 3, 4, 5]
  - id: photon-bunching
    statement: >-
      The photon number's variance is n̄(n̄ + 1), the Bose–Einstein value: its ratio to that is 1 within 0.065 at
      every seed of 1–5 (four standard deviations over seeds 101–130).
    readout: photon variance over n̄(n̄ + 1), measured
    expect: { value: 1, tolerance: 0.065 }
    setup:
      params: { process: einstein }
      seeds: [1, 2, 3, 4, 5]
  - id: atoms-boltzmann
    statement: >-
      The atoms' excited share is Boltzmann's 1/(e + 1) = 0.269 within 0.007 at every seed of 1–5.
    readout: excited share of the atoms, time average, measured
    expect: { against: 'excited share by Boltzmann, 1/(e^(hν/kT) + 1)', tolerance: 0.007 }
    setup:
      params: { process: einstein }
      seeds: [1, 2, 3, 4, 5]
  - id: bose-mean
    statement: >-
      A level that bosons reach at e^(−x)(n + 1) and leave at n holds 1/(e^x − 1) = 0.582 at x = 1 within 0.037,
      at every seed of 1–5 (four standard deviations over seeds 101–130).
    readout: mean occupancy of the level, time average, measured
    expect: { against: 'mean occupancy, Bose–Einstein 1/(e^x − 1)', tolerance: 0.037 }
    setup:
      params: { process: level, stats: bose }
      seeds: [1, 2, 3, 4, 5]
  - id: fermi-mean
    statement: >-
      With fermions, which never arrive at an occupied level, it holds 1/(e^x + 1) = 0.269 within 0.01 at every
      seed of 1–5.
    readout: mean occupancy of the level, time average, measured
    expect: { against: 'mean occupancy, Fermi–Dirac 1/(e^x + 1)', tolerance: 0.01 }
    setup:
      params: { process: level, stats: fermi }
      seeds: [1, 2, 3, 4, 5]
  - id: boltzmann-mean
    statement: >-
      With distinguishable particles, arriving at a constant rate, it holds e^(−x) = 0.368 within 0.018 at every
      seed of 1–5.
    readout: mean occupancy of the level, time average, measured
    expect: { against: 'mean occupancy, Boltzmann e^(−x)', tolerance: 0.018 }
    setup:
      params: { process: level, stats: boltzmann }
      seeds: [1, 2, 3, 4, 5]
---

Things that change at random, each at its own rate: atoms decaying through a chain, atoms absorbing and emitting light, particles arriving at a level and leaving it. Run one change at a time and the averages of physics appear: Bateman's solution of the decay chain, Planck's law of radiation, the Bose–Einstein and Fermi–Dirac occupancies.

**Gillespie's method.** In a population whose changes each happen at a rate set by the present counts, the time to the next change is exponential with the total rate, and which change it is goes by each one's share of that rate. Drawing those two numbers, applying the change and repeating samples the process exactly, with no time step. The plate keeps the counts as a piecewise-constant history and integrates them over time, so a time average is exact for the run it was taken from.

**A decay chain.** Atoms of A turn into B at the rate λ₁ each, and B into the stable C at λ₂. Bateman's solution gives the share in B, λ₁/(λ₂ − λ₁)(e^(−λ₁t) − e^(−λ₂t)), largest at ln(λ₂/λ₁)/(λ₂ − λ₁). Each atom goes its own way, so the measured share scatters binomially about it, by √(p(1 − p)/N₀); the claims allow four of those. A parent much longer-lived than its daughter carries it along at the ratio of their half-lives, secular equilibrium.

**Einstein's atoms.** Two-level atoms in a gas at temperature T are excited and de-excited by collisions at rates in the ratio e^(−hν/kT). They also exchange light with one mode of the radiation: a ground atom absorbs at B·n, an excited one emits at B·(n + 1), the n stimulated and the 1 spontaneous. Einstein's argument, run here as a process, is that the mode can only be in balance with the atoms if its mean photon number is 1/(e^(hν/kT) − 1), Planck's. The plate puts no such number into the run; it measures the mode's time average, and the atoms' excited share, which settles at Boltzmann's 1/(e^(hν/kT) + 1).

**One level, three rules.** A level exchanging particles with a reservoir at (ε − μ)/kT = x loses each at rate 1 and gains one at e^(−x) times a factor that depends on the particles alone: n + 1 for bosons, 1 − n for fermions, 1 for distinguishable ones. The three means that follow are the Bose–Einstein 1/(e^x − 1), the Fermi–Dirac 1/(e^x + 1) and the Boltzmann e^(−x), and the variances n̄(1 + n̄), n̄(1 − n̄) and n̄ show the bosons bunching and the fermions excluding one another. The photon mode of Einstein's atoms is the boson case. Detailed balance in a lattice of spins is #/p/ising-model.

**No reader's data.** The plate's inputs are rates and temperatures, and its runs are seeded samples; a reader's record of counts would call for fitting rates to it, which is #/p/least-squares's work, not a run.
