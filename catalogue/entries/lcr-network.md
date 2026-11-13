---
id: lcr-network
title: Circuits of Coils, Capacitors and Resistors
taxonomy: physics/circuits
status: live
engine: custom
schema: algoglyph.entry/v2
sources:
  - id: feynman-lectures
    ref: 'Vol. I, ch. 23 (resonance) and ch. 25 (linear systems); Vol. II, ch. 17 (induction and the transformer), ch. 22 (AC circuits and filters), ch. 23 (resonance in circuits)'
    purpose: further-reading
  - id: ho-ruehli-brennan-1975
    purpose: implementation
tags:
  - circuits
  - modified nodal analysis
  - resonance
  - filters
  - transformer
  - trapezoidal rule
complexity: O(nodes³) to factor the MNA matrix once, then O(nodes²) a step; a sweep is 121 complex solves
interaction: Choose the circuit; press on the response curve to drive it at that frequency. Attach your own netlist (kind, node a, node b, value) to solve your circuit.
motivation: Three passive parts and a source already show resonance, a filter's cutoff and a transformer's turns ratio; solving them two independent ways shows what a numerical method costs and what it keeps exactly.
relations:
  - type: analogue_of
    target: driven-oscillator
    reason: 'The series RLC is the driven oscillator under a renaming: charge q for x, inductance L for the mass m, resistance R for mγ, 1/C for the spring constant k, the source voltage for the force.'
  - type: uses
    target: gaussian-elimination
    reason: Both solutions are linear systems of the MNA matrix, eliminated with partial pivoting; the phasor one over complex numbers.
  - type: related_to
    target: biquad-filters
    reason: The trapezoidal rule this plate integrates with is the bilinear transform that turns these analogue resonators into the sampled ones there.
  - type: related_to
    target: sine-sweep-ir
    reason: A response measured by driving a system across its frequencies; there on recorded sound, here on a solved circuit.
pedagogy:
  difficulty: intermediate
  objectives:
    - Read a resonance off a swept response and check its frequency 1/√(LC) and its width R/L.
    - See that a time-stepped solution and a phasor solution of one circuit agree, and by how much they differ at a coarse step.
    - Learn that half of a battery's energy is lost in the resistor whenever a capacitor is charged from it, whatever the resistance.
    - Watch a chain of coils and capacitors pass low frequencies and cut off sharply above 2/√(LC).
    - Find a transformer's voltage ratio from its coupling, and the turns ratio as the ideal limit.
  misconceptions:
    - A smaller resistor does not save energy when charging a capacitor from a fixed voltage; it only makes the loss faster.
    - Below cutoff the ladder does not attenuate in principle; what it loses there is reflection at its ends, not absorption.
    - The trapezoidal rule does not damp or amplify a steady oscillation; it plays it at a slightly different frequency.
  questions:
    - Why does the power into L and C average to zero over whole periods while the power into R does not?
    - How many sections does a ladder need to cut a frequency 20 % above its cutoff by a factor of a thousand?
    - What sets the voltage ratio of a transformer whose coupling is not perfect?
algorithm:
  paradigm: numerical-integration
  properties:
    deterministic: true
  preconditions:
    - Every node is connected to ground through some impedance; a floating node makes the MNA matrix singular, and the plate says so.
  invariants:
    - Kirchhoff's current law holds at every node and step, to round-off.
  limitations:
    - Ideal parts only; no diodes, transistors or anything nonlinear.
    - A source is an ideal voltage source driving node 1 against the ground; your netlist cannot add another source.
    - A transient settles for thirty decay times (for your circuit, sixty of its slowest time scales), up to 200 000 steps spread over frames; a circuit slower than that is measured before it has fully settled, and the readout says so.
experiments:
  - id: on-resonance
    title: At resonance
    params: { w: 1 }
    observe: The current is V/R and in phase with the source; L and C cancel.
  - id: high-q
    title: A sharp resonance
    params: { Q: 50, w: 1.02 }
    observe: Two percent off resonance the current is already less than half its peak.
  - id: coarse-step
    title: A coarse time step
    params: { resolution: 20 }
    observe: The transient and the phasor drift apart by about a percent, while the transient and the phasor at the warped frequency still agree.
  - id: rc-slow
    title: Charging slowly
    params: { mode: rc, R: 10 }
    observe: Ten times the resistance, ten times the charging time, and still half the energy lost.
  - id: pass-band
    title: Below the cutoff
    params: { mode: ladder, ratio: 0.6 }
    observe: The wave runs down the whole ladder, delayed by about 2 asin(0.6) per section; the small ripple is the reflection at its resistive end.
  - id: just-above
    title: Just above the cutoff
    params: { mode: ladder, ratio: 1.05 }
    observe: The attenuation per section is only 2 acosh(1.05) ≈ 0.63, but twenty-four sections still cut by e^(−15).
  - id: ideal-transformer
    title: A perfect coupling
    params: { mode: transformer, k: 1 }
    observe: The voltage ratio is the turns ratio, whatever the load.
claims:
  - id: transient-is-warped-phasor
    statement: >-
      (numerics) The trapezoidal transient's steady current equals the phasor solution at the warped frequency
      (2/h)tan(ωh/2) within 1e−8: the trapezoidal rule is the bilinear transform, so it plays the circuit's
      own steady state at a shifted frequency, exactly.
    readout: current amplitude, trapezoidal transient (lock-in)
    expect: { against: 'current amplitude, phasor at the warped frequency (2/h)tan(ωh/2)', tolerance: 0.00000001 }
  - id: transient-near-phasor
    statement: >-
      At 200 steps a period the transient's steady current is within 0.01 of the phasor solution at ω itself
      (about 8e−4 relative here, near a resonance of Q = 10): the frequency warp is second order in the step.
    readout: current amplitude, trapezoidal transient (lock-in)
    expect: { against: 'current amplitude, phasor solve at ω', tolerance: 0.01 }
  - id: phasor-is-impedance
    statement: >-
      The complex MNA solution of the series circuit gives the current V/|R + j(ωL − 1/ωC)| within 1e−9,
      the impedance written out by hand.
    readout: current amplitude, phasor solve at ω
    expect: { against: 'current amplitude, closed form V/|R + j(ωL − 1/ωC)|', tolerance: 0.000000001 }
  - id: resonance-frequency
    statement: >-
      The current peaks at ω₀ = 1/√(LC) within 1e−7, found by a golden-section search on the phasor solve.
    readout: peak of |I|, golden-section search on the phasor solve (ω over ω₀)
    expect: { against: 'resonance 1/√(LC), closed form', tolerance: 0.0000001 }
  - id: q-from-width
    statement: >-
      The half-power points of the swept current are R/L apart, so the resonance's width gives Q =
      (1/R)√(L/C) within 1e−6.
    readout: Q from the half-power width, ω_peak/(ω₊ − ω₋)
    expect: { against: 'Q set, (1/R)√(L/C)', tolerance: 0.000001 }
  - id: power-balance
    statement: >-
      Averaged over twenty whole periods of the transient, the power the source delivers equals the power the
      resistor turns to heat within 1e−9: the inductor and the capacitor only store and return.
    readout: average power from the source, transient
    expect: { against: 'average power into R, transient', tolerance: 0.000000001 }
  - id: kirchhoff
    statement: >-
      (numerics) Kirchhoff's current law holds at every node at every step of the transient, to 1e−9 of the
      largest current.
    readout: Kirchhoff current-law residual, largest relative
    expect: { below: 0.000000001 }
  - id: half-the-energy
    statement: >-
      Charging a capacitor from a 1 V step through 2 Ω turns half of the source's energy, CV²/2 of CV², into
      heat within 1e−6; the other half is stored.
    readout: fraction of the source’s energy turned to heat in R
    expect: { value: 0.5, tolerance: 0.000001 }
    setup:
      params: { mode: rc }
  - id: half-whatever-the-resistance
    statement: >-
      Through 10 Ω the fraction is still one half within 1e−6: the loss does not depend on the resistance.
    readout: fraction of the source’s energy turned to heat in R
    expect: { value: 0.5, tolerance: 0.000001 }
    setup:
      params: { mode: rc, R: 10 }
  - id: stop-band
    statement: >-
      Driven at 1.5 times its cutoff 2/√(LC), the ladder attenuates by 2 acosh(1.5) = 1.925 nepers a section
      over its middle half, within 1e−6, the infinite ladder's closed form.
    readout: attenuation per section, measured over the middle half (nepers)
    expect: { against: 'attenuation per section 2 acosh(ω/ω_c), the infinite ladder', tolerance: 0.000001 }
    setup:
      params: { mode: ladder }
  - id: loaded-transformer
    statement: >-
      Two coils of turns ratio 2 coupled by k = 0.9 into 3 Ω give |V₂/V₁| = ωMR/|jωL₁R − ω²L₁L₂(1 − k²)| within
      1e−9, the two loop equations solved by hand.
    readout: '|V₂/V₁|, phasor solve'
    expect: { against: '|V₂/V₁|, closed form ωMR/|jωL₁R − ω²L₁L₂(1 − k²)|', tolerance: 0.000000001 }
    setup:
      params: { mode: transformer }
  - id: ideal-transformer
    statement: >-
      At perfect coupling, k = 1, the voltage ratio is the turns ratio √(L₂/L₁) = 2 within 1e−9.
    readout: '|V₂/V₁|, phasor solve'
    expect: { against: 'turns ratio n = √(L₂/L₁), the ideal transformer’s |V₂/V₁|', tolerance: 0.000000001 }
    setup:
      params: { mode: transformer, k: 1 }
  - id: transformer-power
    statement: >-
      Averaged over twenty periods of the transient, the power into the primary equals the power into the
      load within 1e−9: ideal coils lose nothing.
    readout: average power from the source, transient
    expect: { against: 'average power into the load, transient', tolerance: 0.000000001 }
    setup:
      params: { mode: transformer }
data:
  - id: netlist
    title: Your circuit
    kind: table
    accepts: [csv, json]
    columns:
      - { key: kind, unit: '1 = R, 2 = L, 3 = C', min: 1, max: 3 }
      - { key: a, unit: node, min: 0, max: 16 }
      - { key: b, unit: node, min: 0, max: 16 }
      - { key: value, unit: 'Ω, H or F', min: 1.0e-12, max: 1.0e12 }
    rows: { min: 1, max: 24 }
    bytes: 8192
    replaces: mode
    ignores: [Q, w, R, sections, ratio, turns, k, load]
    url_bytes: 1800
    note: A 1 V AC source drives node 1 against the ground (node 0); the plate sweeps the highest-numbered node's voltage over the circuit's own time scales, drives it at the sweep's peak (or where you press), and solves it both as a transient and as phasors.
---

Passive circuits solved two independent ways, by time steps and by phasors: a series resonant circuit, a capacitor charged through a resistor, a ladder of coils and capacitors that filters, and a pair of coupled coils.

**One description, two solutions.** A circuit is a netlist: each part between two numbered nodes, node 0 the ground. Modified nodal analysis writes Kirchhoff's current law at every node and one equation for each inductor and source, unknowns the node voltages and those branch currents. At a single angular frequency ω every part is a complex admittance (1/R, jωC) or a branch equation (V = jωL I, plus jωM I₂ for a coupled partner), and one complex system solved by elimination with partial pivoting gives the steady state. In time, each capacitor and inductor is replaced by its trapezoidal companion, a conductance and a source carried over from the last step; the real matrix is factored once and solved at every step from rest. A lock-in over twenty whole periods reads the transient's amplitude and phase once it has settled.

**What the trapezoidal rule does.** Applied to a linear circuit it is the bilinear transform: under a drive at ω its steady state is exactly the phasor solution at the slightly higher frequency (2/h)tan(ωh/2). So the transient agrees with the phasor solution at that warped frequency to round-off, and with the solution at ω itself to second order in the step, which matters most near a sharp resonance. The same transform turns these analogue resonators into the digital ones of #/p/biquad-filters.

**Resonance.** The series circuit is the driven oscillator of #/p/driven-oscillator under a renaming: charge for displacement, inductance for mass, resistance for friction, the reciprocal of capacitance for stiffness. Its current peaks at 1/√(LC), in phase with the source; the half-power points are R/L apart, so Q = (1/R)√(L/C). Averaged over whole periods the source's power all goes into R; L and C only hold it for part of each cycle.

**Charging a capacitor.** A step of V through R into C delivers CV² from the source and leaves CV²/2 in the capacitor: the other half is heat, for every R, because the current and the time it flows trade against each other exactly.

**The ladder.** Coils in series with capacitors to ground at every node make a low-pass filter. For an infinite chain each section multiplies the voltage by e^(−2 acosh(ω/ω_c)) above the cutoff ω_c = 2/√(LC) and delays it by 2 asin(ω/ω_c) below; a finite ladder ends in resistors that reflect a little in the pass band and nothing measurable in the stop band. The same recurrence is the discrete string of beads.

**The transformer.** Two coils with mutual inductance M = k√(L₁L₂): the ratio of their voltages follows from two loop equations, and at perfect coupling it is √(L₂/L₁), the turns ratio, whatever the load.

**Your circuit.** A table of parts (kind 1 for a resistor, 2 a coil, 3 a capacitor; two node numbers; a value) is solved with a 1 V source at node 1. The plate sweeps the highest node's voltage across the time scales the values make, drives at the peak, and reports both solutions and their gap. The table stays in the browser.
