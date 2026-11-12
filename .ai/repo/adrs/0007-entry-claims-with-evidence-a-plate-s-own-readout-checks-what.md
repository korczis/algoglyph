---
schema: adr/v1
id: adr-0007
kind: adr
title: Entry claims with evidence: a plate's own readout checks what an entry states
status: proposed
date: 2026-11-12
tags:
  - catalogue
  - evidence
provenance:
  origin: authored
---

# 7. Entry claims with evidence: a plate's own readout checks what an entry states

## Context

ADR 0006 §4 asks every claim on a page to be tied to a source or to the test that checks it.
Bounds (`bounds`) state what analysis says, and each exact one is checked against a counted run
in a test written for its wing. Many plates measure an outcome rather than count an operation:
how often an interval covers the truth, how wide it is, how far a posterior sits from the
closed form. Those outcomes were stated only in the reading notes, where nothing can link,
derive or check them. The owner's order is that everything be described in front matter.

## Decision

An entry may carry `claims` (catalogue/schema/entry.yaml): each an `id`, a `statement`, the
`readout` it is about (the label of a row the plate publishes), the `expect`ation (a `value`
with an optional `tolerance`, an inclusive `range`, or a strict `below` or `above` for a one-sided
claim, in the readout's displayed units, exponents read), an
optional `setup` (`params` on the plate, `seed`) and an optional `source`.

The evidence is never authored. One instrument, `test/support/claims.ts`, serves every entry:
it runs the plate headless with the claim's setup and seed (loop off, 4242 by default) until
every readout has stayed the same for 120 frames, reads the first number of the named
readout and judges it against `expect`. `test/claims.test.ts` runs it for every claim in the
catalogue. A claim whose readout the plate does not publish, whose setup names a parameter the
plate lacks, whose run does not settle, or whose value misses its expectation fails the gate.

`scripts/lib/catalogue.mjs` checks the static form (exactly one of value and range, a range
[lo, hi] with lo <= hi, exactly one expectation form, a tolerance only around a value, ids
unique within the entry) and
derives `evidence.claims` ({ declared, instrument }); a claim without its instrument is
refused where the catalogue is checked with code.

## Alternatives rejected

- Outcomes left in the notes: nothing links, derives or checks them.
- A test per entry: every claim would need test code of its own, and the evidence would vary
  with whoever wrote it. One instrument reads every claim the same way.
- Judging a claim after a fixed number of frames: plates spread work over frames by wall-clock
  budgets, so a fixed count reads a different point of the run on a slower machine. A settled
  run is deterministic for its seed on any machine.
- A verdict stored in the catalogue: a stored verdict is a copy that goes stale; the verdict is
  the test's, on every run.

## Consequences

- A claim reads what the plate measures at one seed, so its expectation must allow for the
  run's own sampling error; the statement says how wide that is.
- A plate that never settles (a simulation that runs forever) cannot carry a claim until it
  publishes a readout that does.
- The instrument costs one headless run per claim in the unit suite; the pilots settle in
  under a second each.
- Later waves add claims wherever a plate measures something; wave 3 (inference) uses them
  for its measured outcomes.
