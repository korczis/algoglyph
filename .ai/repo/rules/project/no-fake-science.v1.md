---
id: project.no-fake-science
version: 1
kind: rule
title: Readouts are measured and notes are true
description: Every number a plate shows is computed from the running simulation, and every claim in a plate's notes is a fact about the code or established science.
statement: Publish only readouts computed from the simulation's own state (counts, energies, distances, spreads), never constants or estimates dressed as measurements, and write plate notes that a reader can check against the code or a standard reference.
status: active
class: blocking
depends_on: [project.viz-component-layer@2]
tags: [content, science, honesty]
---

# Rationale

The collection is art, but it is also a claim: this is what quicksort, BFS, RK4 or leapfrog
actually do. A decorative number or a wrong mechanism in the notes teaches the wrong thing
behind a beautiful picture.

# Required behaviour

- Physics plates integrate real equations with a named integrator (RK4, leapfrog, Verlet,
  explicit finite differences) and report a conserved quantity or its drift where one exists.
- Algorithm plates count operations exactly as performed (comparisons, writes, frontier size).
- A note that names a property (chaotic, symplectic, exact, stable) has a unit test or a
  readout that shows it: `test/physics.test.ts` and `test/algorithms.test.ts` hold them.
- Reference values in tests come from an independent source (node:crypto, brute force, a known
  sequence), never from the code under test.

# Failure behaviour

A constant readout, an unverifiable note or a test that checks the code against itself is a
blocking review finding.

# Verification

`npx vitest run` and a reviewer reading each new plate's notes against its code.
