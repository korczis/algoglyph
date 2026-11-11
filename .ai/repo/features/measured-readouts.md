---
schema: feature/v1
id: measured-readouts
kind: feature
title: Every number on a plate is measured from the running state
short_title: Measured readouts
headline: The readouts beside a plate are counted from the simulation itself, so the picture can be read as well as looked at.
summary: Algorithm plates count comparisons, writes and frontier sizes as performed; physics plates integrate real equations with a named integrator and report a conserved quantity or its drift; unit tests check them against independent reference values.
status: stable
weight: 20
featured: true
domain: gallery
rules: [project.no-fake-science]
docs: [README.md]
related: [plates]
tags: [readouts, physics, algorithms, tests]
---

## What it does

A readout is computed from the plate's own state on every frame. A property a note names,
such as chaotic, symplectic or exact, has a unit test or a readout that shows it, and the
reference values in those tests come from an independent source rather than from the code
under test.

## What it does not do

It does not show estimates or constants dressed as measurements; a constant readout or a
note that cannot be checked against the code is a blocking review finding.
