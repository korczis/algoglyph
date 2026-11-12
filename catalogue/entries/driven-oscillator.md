---
id: driven-oscillator
title: The Driven Oscillator
taxonomy: physics/mechanics
status: live
engine: custom
schema: algoglyph.entry/v2
sources:
  - id: feynman-lectures
    ref: 'Vol. I, ch. 21 (the harmonic oscillator), ch. 23 (resonance), ch. 24 (transients), ch. 49 (modes)'
    purpose: further-reading
  - id: abramowitz-stegun
    ref: 'Chapter 17: K(k) by the arithmetic-geometric mean, and table 17.1'
    purpose: implementation
tags:
  - oscillator
  - resonance
  - quality factor
  - damping
  - pendulum
  - coupled oscillators
complexity: O(steps) by RK4 at 400 steps a period; a sweep is 61 lock-ins
interaction: Choose the experiment; drive frequency, Q, damping ratio, release angle and coupling are its parameters.
motivation: The one equation of physics that turns up everywhere, from a swing to an atom's response to light.
relations:
  - type: related_to
    target: lissajous
    reason: Two oscillations at once; there traced against each other as a figure, here driven against a response.
  - type: related_to
    target: biquad-filters
    reason: A resonant filter is this oscillator sampled in time, its Q the same ω₀/γ.
  - type: related_to
    target: double-pendulum
    reason: The pendulum mode's nonlinearity, taken to two coupled arms, becomes chaos.
  - type: related_to
    target: kuramoto
    reason: Many oscillators coupled to each other, there by their phases until they lock.
  - type: uses
    target: least-squares
    reason: The ring-down's decay rate is the least-squares slope of the logarithm of successive peaks.
pedagogy:
  difficulty: intermediate
  objectives:
    - Drive a damped oscillator and read its steady amplitude and phase lag against the closed form.
    - Measure Q two ways, from the width of the absorbed-power resonance and from the ring-down, and see them agree.
    - Find the damping at which a released oscillator returns fastest without overshooting.
    - Watch a pendulum's period lengthen at large amplitude as the elliptic integral says.
    - See two coupled oscillators trade their energy at the difference of their normal-mode frequencies.
  misconceptions:
    - Resonance is not where the response is infinite; damping caps it, and the width of the peak measures the damping.
    - The phase lag is not a delay of fixed time; it runs from 0 below resonance through π/2 at it to π above.
    - A pendulum is isochronous only for small swings; at 150° its period is 76 % longer.
  questions:
    - Why does the absorbed power peak exactly at ω₀ while the displacement peaks a little below it?
    - How many cycles does a ring-down take to lose most of its energy, for a given Q?
    - What happens to the beat period as the coupling spring weakens?
algorithm:
  paradigm: numerical-integration
  properties:
    deterministic: true
  preconditions:
    - ω₀Δt ≈ 0.016, far inside RK4's stability on the imaginary axis (|ωΔt| < 2.83).
  limitations:
    - Linear damping only; dry friction and amplitude-dependent losses are not modelled.
    - The lock-in waits 28/γ for the transient to decay to e^(−14) before measuring; very light damping would need longer.
    - The resonance width is read from 61 frequencies by linear interpolation at the half-maximum crossings, which limits it to a fraction of a percent.
experiments:
  - id: below-resonance
    title: Driven slowly
    params: { w: 0.4 }
    observe: The response follows the drive in phase, with the static amplitude F₀/mω₀².
  - id: above-resonance
    title: Driven fast
    params: { w: 1.6 }
    observe: The response is small and nearly opposite to the drive.
  - id: underdamped
    title: Underdamped release
    params: { mode: critical, zeta: 0.3 }
    observe: It swings through zero and back, overshooting by e^(−ζπ/√(1 − ζ²)).
  - id: small-swing
    title: A small swing
    params: { mode: pendulum, theta: 10 }
    observe: The period is within a fraction of a percent of 2π/ω₀.
claims:
  - id: steady-amplitude
    statement: >-
      Driven at 0.95 ω₀ with Q = 10, the oscillator settles to the closed-form amplitude
      (F₀/m)/√((ω₀² − ω²)² + γ²ω²) within 1e−5, measured by a lock-in over twenty whole periods.
    readout: amplitude, lock-in over 20 periods
    expect: { against: 'amplitude, closed form (F₀/m)/√((ω₀² − ω²)² + γ²ω²)', tolerance: 0.00001 }
  - id: steady-phase
    statement: >-
      Its phase lag behind the drive matches atan2(γω, ω₀² − ω²) within 1e−5 rad.
    readout: phase lag, lock-in (rad)
    expect: { against: 'phase lag, closed form atan2(γω, ω₀² − ω²)', tolerance: 0.00001 }
  - id: power-width-is-gamma
    statement: >-
      The absorbed power, swept over 61 frequencies, has a full width at half maximum of γ within 1 %:
      the resonance's width measures the damping.
    readout: width of the absorbed power at half maximum, measured
    expect: { against: 'γ, the width in closed form', tolerance: 0.002 }
    setup:
      params: { mode: resonance }
  - id: q-two-ways
    statement: >-
      Q from the ring-down, ω₀ over twice the decay rate of successive peaks, matches the Q set,
      ω₀/γ, within 0.5 %; the width of the resonance gives the same Q to its interpolation error.
    readout: Q from the ring-down, ω₀/(2 × decay rate of the peaks)
    expect: { against: 'quality factor set, Q = ω₀/γ', tolerance: 0.05 }
    setup:
      params: { mode: resonance }
  - id: critical-no-overshoot
    statement: >-
      Released from x = 1 at critical damping, ζ = 1, the oscillator never crosses zero: its least x is
      above −1e−9.
    readout: least x after release from x = 1, measured
    expect: { above: -0.000000001 }
    setup:
      params: { mode: critical, zeta: 1 }
  - id: underdamped-overshoot
    statement: >-
      At ζ = 0.3 it overshoots to −exp(−ζπ/√(1 − ζ²)) = −0.3723, matched within 1e−4.
    readout: least x after release from x = 1, measured
    expect: { against: 'first undershoot in closed form, −exp(−ζπ/√(1 − ζ²))', tolerance: 0.0001 }
    setup:
      params: { mode: critical, zeta: 0.3 }
  - id: pendulum-period
    statement: >-
      A pendulum released at 150° swings with the period 4K(sin 75°)/ω₀ within 1e−5, K computed by the
      arithmetic-geometric mean and independent of the integrator; that is 76 % longer than 2π/ω₀.
    readout: period, measured from zero crossings
    expect: { against: 'period 4K(sin θ₀/2)/ω₀, K by the arithmetic-geometric mean', tolerance: 0.00001 }
    setup:
      params: { mode: pendulum, theta: 150 }
  - id: coupled-beat
    statement: >-
      Two oscillators coupled by κ = 0.1ω₀² hand their energy back and forth with the beat period
      2π/(ω₂ − ω₁), ω₂ = √(ω₀² + 2κ), within 0.05 of 32.9.
    readout: beat period, measured from the envelope
    expect: { against: 'beat period 2π/(ω₂ − ω₁)', tolerance: 0.05 }
    setup:
      params: { mode: coupled }
---

A mass on a spring, damped and driven, in five experiments: the steady state, a resonance sweep with its ring-down, the release from rest, a pendulum at large amplitude, and two oscillators coupled by a spring.

**The equation.** ẍ + γẋ + ω₀²x = (F₀/m) cos ωt, integrated by the shared fourth-order Runge–Kutta method at 400 steps a period, far inside its stability limit. Q = ω₀/γ counts how many radians of oscillation it takes for the energy to fall by e. Every readout comes from the integrated run, measured as an experimenter would; the closed forms beside them are what they are held to.

**Driven.** After the start-up transient has died away, the oscillator moves at the drive's frequency with amplitude (F₀/m)/√((ω₀² − ω²)² + γ²ω²) and a phase lag atan2(γω, ω₀² − ω²): in step with a slow drive, a quarter cycle behind at resonance, nearly opposite to a fast one. A lock-in correlates the run with the drive over twenty whole periods to read both.

**Resonance and ring-down.** Swept across ω₀ ± 3γ, the power the drive feeds in, ½mγ(ωA)², peaks at ω₀ with a full width at half maximum of exactly γ. Released and left alone, the oscillator's peaks decay as e^(−γt/2); a least-squares line through their logarithms gives the rate. The two give the same Q.

**Release.** Below critical damping, ζ = γ/2ω₀ < 1, a released oscillator swings through zero and overshoots by e^(−ζπ/√(1 − ζ²)); at ζ = 1 it returns as fast as it can without crossing; above, more slowly. **The pendulum.** With sin θ in place of θ, the period grows with amplitude as 4K(sin θ₀/2)/ω₀, the complete elliptic integral K computed independently by the arithmetic-geometric mean. **Coupled.** Two identical oscillators joined by a spring κ have normal modes ω₀ and √(ω₀² + 2κ); started with one moving, the energy beats from one to the other with the period 2π over their difference. Driven at two frequencies the same motion traces #/p/lissajous figures; a resonant digital filter in #/p/biquad-filters is this equation sampled in time.
