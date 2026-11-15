---
id: least-action
title: Least Action
taxonomy: physics/mechanics
status: live
engine: custom
schema: algoglyph.entry/v2
aliases:
  - stationary action
  - Hamilton's principle
  - variational integrator
sources:
  - id: feynman-lectures
    ref: 'Vol. II, ch. 19 (the principle of least action)'
    purpose: further-reading
  - id: goldstein-classical-mechanics
    ref: 'Chapter 2: Hamilton''s principle and the calculus of variations'
    purpose: implementation
  - id: marsden-west-2001
    ref: 'Discrete Lagrangians, the discrete Euler–Lagrange equations, and Störmer–Verlet as their solution'
    purpose: implementation
  - id: hairer-lubich-wanner
    ref: 'Chapter VI: variational integrators and why they are symplectic'
    purpose: implementation
  - id: gray-taylor-2007
    ref: 'Kinetic foci (conjugate points) and when the stationary action stops being a minimum'
    purpose: further-reading
tags:
  - principle of least action
  - Lagrangian
  - calculus of variations
  - conjugate point
  - Morse index
  - Newton's method
  - Störmer–Verlet
  - variational integrator
complexity: O(N) per Newton iteration (one tridiagonal solve), a few iterations; O(800 N) when the path has to be found by shooting
interaction: Choose the potential, the time between the ends and the two ends q(0) and q(T); the number of steps sets how finely the path is cut.
motivation: Nature's law of motion can be written as a statement about whole paths, that the true one makes the action stationary; cut the path into steps and the same statement, solved exactly, is the integrator used everywhere else in the collection.
relations:
  - type: related_to
    target: kepler-orbits
    reason: The leapfrog that integrates the orbits there is the stationary point of this discrete action, which is why its energy error stays bounded orbit after orbit.
  - type: uses
    target: gaussian-elimination
    reason: Each Newton step solves the tridiagonal Hessian system by elimination without pivoting on a band of width three, the Thomas algorithm.
  - type: related_to
    target: rays-and-lenses
    reason: Fermat's principle is the optical form of the same idea; a ray makes its optical path length stationary, and a lens shows the stationary path need not be the shortest.
  - type: compares_with
    target: simulated-annealing
    reason: Annealing looks for a minimum; past half a period the true path is a saddle of the action, which a minimiser would never return and Newton on the gradient finds directly.
pedagogy:
  difficulty: advanced
  objectives:
    - Write the action of a path as a sum over its steps and find the path that makes it stationary with both ends held.
    - See that setting the action's gradient to zero gives the Störmer–Verlet recurrence, and check it by shooting Verlet from the path's first two points.
    - Count the negative directions of the action's Hessian and find the first conjugate point of the oscillator at half a period.
    - Compare the measured path and action with their closed forms and see the error fall as the square of the step.
  misconceptions:
    - The action of the true path is not always least; once the time between the ends passes half a period of the oscillator it is a saddle, less than some neighbours and more than others.
    - The principle does not choose an end from a start; both ends are given, and a motion is found between them, if there is one.
    - Least action is not a different law from Newton's; its stationary condition is Newton's equation, and the discrete one is the integrator.
    - More than one path can join the same ends in the same time; the pendulum and the quartic well often have several, and the plate reports the one it found.
  questions:
    - Why does a bump of the shape sin(πt/T) lower the oscillator's action once T exceeds π/ω?
    - For uniform gravity, why is the discrete path exactly the parabola, at any step?
    - How many negative eigenvalues does the Hessian have at T = 10/ω, and which bumps lower the action?
    - Why does shooting Verlet forward from the path's first two points drift away from the path faster for the pendulum swung over the top?
algorithm:
  paradigm: iterative-refinement
  properties:
    deterministic: true
  preconditions:
    - The potential is smooth; its first and second derivatives are given in closed form.
  invariants:
    - Each accepted Newton step lowers the largest component of the gradient; the run ends when it is round-off.
    - The stationary discrete path satisfies the Störmer–Verlet recurrence at every interior point.
  limitations:
    - When Newton from the straight line fails, shooting scans first steps of speed −10 to 10; a path that needs a faster start is not found, and the plate says it did not converge.
    - Of several stationary paths, the one found is Newton's from the straight line, or the shot path nearest the straight line's speed; the others are not listed.
    - Unit mass; ω = 1, g = 1 and the quartic's coefficient 1.
experiments:
  - id: a-minimum
    title: A short time, a true minimum
    params: { potential: harmonic, T: 2 }
    observe: Both bumps raise the action, the Hessian has no negative eigenvalue, and the straight line's action is above the true path's.
  - id: past-half-a-period
    title: Past the first conjugate point
    params: { potential: harmonic, T: 5 }
    observe: The first bump now lowers the action, one eigenvalue is negative, and the straight line has less action than the path nature takes.
  - id: three-conjugate-points
    title: Three conjugate points
    params: { potential: harmonic, T: 10 }
    observe: The Hessian has three negative eigenvalues, one for each half period passed, ⌊ωT/π⌋.
  - id: free-fall
    title: Thrown up and caught
    params: { potential: uniform, a: 0, b: 0, T: 2 }
    observe: The path is the parabola ½gt(T − t) to round-off at any step, because the force is constant.
  - id: pendulum-over-the-top
    title: A pendulum swung through the bottom
    params: { potential: pendulum, a: 2.5, b: -2, T: 4 }
    observe: Newton needs several iterations from the straight line; Verlet shot from the path's start retraces it but drifts by a few parts in a billion, the instability of the swing.
  - id: quartic-by-shooting
    title: A quartic well, found by shooting
    params: { potential: quartic, T: 6 }
    observe: Newton from the straight line stalls; shooting finds a path that hits the end, Newton polishes it, and it has one negative direction.
  - id: coarse-path
    title: Twenty steps
    params: { points: 20 }
    observe: The path is still Verlet's to round-off, but its distance from the closed form grows a hundredfold, the square of the tenfold step.
claims:
  - id: stationary-is-verlet
    statement: >-
      The stationary discrete path of the oscillator is the Störmer–Verlet trajectory: shot from its first
      two points, Verlet passes through every other point within 1e−10.
    readout: largest gap to the Verlet trajectory shot from q₀, q₁
    expect: { below: 0.0000000001 }
  - id: pendulum-stationary-is-verlet
    statement: >-
      For the pendulum from q = 2.5 to −2 in T = 4, a nonlinear problem solved by Newton from the straight line,
      Verlet shot from the path's start still retraces it within 1e−7; the drift that remains is round-off
      amplified by the swing.
    readout: largest gap to the Verlet trajectory shot from q₀, q₁
    expect: { below: 0.0000001 }
    setup:
      params: { potential: pendulum, a: 2.5, b: -2, T: 4 }
  - id: gradient-vanishes
    statement: >-
      (numerics) At the path found, every component of the action's gradient is below 1e−12.
    readout: largest |∂S/∂qₖ| of the stationary path, numerics
    expect: { below: 0.000000000001 }
  - id: oscillator-path
    statement: >-
      With 200 steps over T = 2, the stationary path is within 3e−5 of the closed form
      (a sin ω(T − t) + b sin ωt)/sin ωT; the discretisation error is second order in the step.
    readout: largest |qₖ − q(tₖ)| against the closed-form path
    expect: { below: 0.00003 }
  - id: oscillator-action
    statement: >-
      The discrete action of the stationary path equals (ω/2 sin ωT)((a² + b²) cos ωT − 2ab) within 1e−5.
    readout: action S of the stationary path
    expect: { against: 'action, closed form (ω/2 sin ωT)((a² + b²) cos ωT − 2ab)', tolerance: 0.00001 }
  - id: free-fall-exact
    statement: >-
      Under uniform gravity the stationary path is the parabola ½gt(T − t) within 1e−12 at any step:
      Verlet is exact for a constant force.
    readout: largest |qₖ − q(tₖ)| against the closed-form path
    expect: { below: 0.000000000001 }
    setup:
      params: { potential: uniform, a: 0, b: 0 }
  - id: least-before-half-period
    statement: >-
      For T = 2 < π/ω the Hessian of the action has no negative eigenvalue: the stationary path is a minimum.
    readout: negative eigenvalues of the Hessian (Morse index), by a Sturm count
    expect: { value: 0, tolerance: 0.5 }
  - id: straight-line-above
    statement: >-
      For T = 2 the straight line from a to b has more action than the stationary path, as a minimum requires.
    readout: action of the straight line less the stationary action
    expect: { above: 0 }
  - id: one-conjugate-point
    statement: >-
      For T = 5, past π/ω, the Sturm count finds one negative eigenvalue, as many as the conjugate points
      ⌊ωT/π⌋ of the continuous path.
    readout: negative eigenvalues of the Hessian (Morse index), by a Sturm count
    expect: { against: '⌊ωT/π⌋, conjugate points of the continuous path', tolerance: 0.5 }
    setup:
      params: { T: 5 }
  - id: three-conjugate-points
    statement: >-
      For T = 10 the count is three, again ⌊ωT/π⌋.
    readout: negative eigenvalues of the Hessian (Morse index), by a Sturm count
    expect: { against: '⌊ωT/π⌋, conjugate points of the continuous path', tolerance: 0.5 }
    setup:
      params: { T: 10 }
  - id: straight-line-below
    statement: >-
      For T = 5 the straight line has less action than the path nature takes: the stationary path is a
      saddle, not a minimum.
    readout: action of the straight line less the stationary action
    expect: { below: 0 }
    setup:
      params: { T: 5 }
  - id: second-variation
    statement: >-
      For T = 5 the second variation of the discrete action along sin(πt/T) is negative and matches the
      continuous (T/2)((π/T)² − ω²) within 1e−4.
    readout: second variation along sin(πt/T), ηᵀHη
    expect: { against: 'second variation, continuous (T/2)((π/T)² − ω²)', tolerance: 0.0001 }
    setup:
      params: { T: 5 }
---

A particle's path between two fixed ends, found as the path that makes a discrete action stationary, then checked against Verlet, against the closed forms of the oscillator and free fall, and against the count of conjugate points that says whether it is a minimum.

**The action of a path.** The path is cut into N steps of h = T/N, with q₀ = a and q_N = b held. Its action is S = Σ[(qₖ₊₁ − qₖ)²/2h − (h/2)(V(qₖ) + V(qₖ₊₁))]: the kinetic energy from the differences, the potential by the trapezoidal rule. The plate finds the path whose gradient ∂S/∂qₖ vanishes at every interior point. That gradient is (2qₖ − qₖ₋₁ − qₖ₊₁)/h − hV′(qₖ), and its Hessian is tridiagonal, so Newton's method costs one elimination along a band per iteration, from the straight line as the first guess; a backtracking line search keeps each accepted step from enlarging the gradient. For a nonlinear potential over a long time Newton can stall, and the plate then shoots instead: it scans the first step, runs Verlet to the far end, refines each miss that changes sign by bisection, and polishes the nearest path by Newton.

**Why the integrator is the principle.** A zero gradient reads qₖ₊₁ = 2qₖ − qₖ₋₁ − h²V′(qₖ), the Störmer–Verlet recurrence. The plate checks it directly: Verlet shot forward from the path's first two points passes through all the others to round-off. This is why the leapfrog of #/p/kepler-orbits keeps its energy error bounded: it is the exact motion of a discrete Lagrangian, a variational integrator.

**When action is not least.** The second variation decides. Along a bump η = sin(jπt/T) the oscillator's continuous action changes by (ε²T/4)((jπ/T)² − ω²), positive while T < jπ/ω. So for T below half a period every bump raises the action and the path is a minimum; past π/ω the first bump lowers it and the path becomes a saddle, the first conjugate point (a kinetic focus). The plate counts the negative eigenvalues of the discrete Hessian by the signs of its LDLᵀ pivots, which by Sylvester's law of inertia is the Morse index, and finds ⌊ωT/π⌋. On the right it plots the action along the first two bumps: two parabolas opening up for a short time, one opening down past half a period. The straight line between the ends then has less action than the true path.

**Closed forms.** The oscillator's path (a sin ω(T − t) + b sin ωt)/sin ωT and its action (ω/2 sin ωT)((a² + b²) cos ωT − 2ab) are matched to the discretisation error, second order in h; free fall's parabola is matched to round-off at any step. Fermat's principle in #/p/rays-and-lenses is the same stationarity for light.
