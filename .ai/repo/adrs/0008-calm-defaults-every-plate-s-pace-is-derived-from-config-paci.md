---
schema: adr/v1
id: adr-0008
kind: adr
title: Calm defaults: every plate's pace is derived from config/pacing.yaml and from its own run
status: proposed
date: 2026-11-12
tags:
  - pacing
  - ui
provenance:
  origin: authored
---

# 8. Calm defaults: every plate's pace is derived from config/pacing.yaml and from its own run

## Context

The owner, in session 8b702ebf-3f15-4e77-880e-843436e75d2c on 2026-11-12, verbatim: "defaultni
animace jsou prilis rychle az chaoticke" (the default animations are too fast, to the point of
chaos).

Every engine had a `speed` of its own, in its own unit, with a default typed by hand: six
operations a frame for every array kernel whatever its trace, a per-kernel `speed` in the graph,
grid and string kernels, a per-kernel `rate` in the numeric and signal kernels. Measured headless
at the defaults, seed 4242, loop off, counting frames at 60 fps, on origin/main
4fe83608e62ead0a0aa701628962fb55c2060a43: the median finite run lasted 3.1 s, 232 of the 268
finite replays ended in under 8 s and 121 in under 3 s, at a median of 360 counted changes a
second and up to 36 000 (centrality-comparison, 600 events a frame). Some ended almost at once
(grid-method in 0.13 s, quickhull in 0.18 s). Every step engine also passed a fractional speed
straight into its replay, where it ran one whole event per frame, and the geometry engine
indexed its track with it and drew a blank frame.

Owner answer, recorded verbatim. The question, as relayed by the coordinating session: how many
visible changes per second a default animation may show. The answer: "30/s" (session
8b702ebf-3f15-4e77-880e-843436e75d2c, 2026-11-12). The same session decided the rest of this
record with the coordinator's approval of the phase 1 proposal: a pace multiplier as the control,
20 s within [10, 60] s as the target, 8 views a second for recorded runs, emergent streams
uncapped with a declared reason, the hold derived from the same file.

## Decision

1. **One file says how calm a default is: `config/pacing.yaml`.** Three kinds, each with its
   numbers: `replay` (a finite trace of counted changes: target 20 s, window [10, 60] s, ceiling
   30 changes a second, floor 1), `views` (a recorded run replayed view by view: the same window,
   ceiling 8), `stream` (an endless run: ceiling 30). The frame rate the contract counts in, the
   hold after a run and the pace control's range are in the same file. The site reads it through
   `virtual:pacing` (scripts/lib/vite-pacing.mjs), checked by scripts/lib/pacing.mjs; a broken
   file fails the build, the dev server and the unit suite with the same messages.
2. **The rate is derived from the run itself** (src/core/pace.ts). A run of L changes replays at
   `L / (target × fps)` changes a frame, within the kind's floor and ceiling; a stream at its
   ceiling. A run whose length is learnt only while it replays (a graph run computed in slices,
   a signal or stochastic run recorded as it is shown) replays at the ceiling until its length is
   known, then at the rate that ends it when a calm run of that length would have ended. A lab
   paces every pane alike from its longest run, so the race stays fair.
3. **Fractions are carried, never rounded up.** `Pacer.take` returns whole changes per frame and
   carries the fraction: 0.25 a frame is one change every fourth frame. A frame applies 0, 1 or
   more whole changes through the replay it always had; no frame computes anything it did not.
4. **The control is a multiplier: `pace`, "× calm", 1 by default, on a log slider** (RangeParam
   `log`) from 1/8 to 4096. The applied rate is clamped to each engine's old per-frame maximum,
   so the budget gate's heaviest corner (config/budgets.yaml) is the one it has always measured.
   The readout says what the pace does: the multiplier, the rate in the plate's unit and how long
   the run lasts. The old `speed` key is gone: a link that carries `?speed=` opens at the calm
   default, because share.parse ignores keys a plate does not have.
5. **A run too long to watch counts a coarser change, or starts from a smaller input.** Where the
   kernel has a natural step, a long run counts it: a graph kernel charted by rounds counts rounds,
   a string kernel its notes, the hash engine its key operations, the systems engine the changes
   its lanes show while simulated time runs evenly. Elsewhere the default input is the largest one
   whose calm run fits `fit_s`: derived at load for the array engine and the tree and graph labs
   (`fitSize`), set in the kernel's or plate's own data where a run is costly to repeat, each
   change named in the commit that made it.
6. **Every plate declares its pace** (`PlateCode.pace`): a kind and a unit, or an emergent stream
   (`emergent: <why>`: an integrator, Langton's turmites, the avalanche statistic, whose own
   controls set simulated time and are not capped), or a still plate (`why`: a picture rendered
   progressively). Only an emergent stream or a still plate keeps a rate control of its own.
7. **Enforced, counted, never timed.** `test/pacing.test.ts` checks the file, the derivation and,
   for every live plate and runnable lab at its defaults, the declaration and the arithmetic
   (a default run lasts within its window, unless it is shorter in content than the window's
   start at the floor, and shows no more than its ceiling), each rule with a negative case.
   `npm run test:pacing` (test/pacing/, one process per wing, alone, its own CI step) drives every
   run to its end and counts its frames. The claims instrument (ADR 0007) reads a run at the pace
   control's top and waits for a paced run to report its end, so a calm run is never read as
   settled half-way.

## Alternatives rejected

- A default speed derived once per kernel, in each engine's own unit: it would not follow the
  input slider, and it needs a trace at load for every engine, some of them costly.
- Per-plate hand-tuned defaults: the state this decision replaces.
- A ceiling of 60 changes a second (one per drawn frame): the owner chose 30.
- Rounding a fractional speed to whole events: what the engines did by accident.
- A select of fixed multipliers: every option is a heavy corner of the budget gate.

## Consequences

- Default runs take about 20 s and at most a minute; the pace control reaches the old speeds.
- Engines and plates carry no rate of their own: the per-kernel `speed` and `rate` fields are
  gone, and a new engine or plate derives its pace from config/pacing.yaml or fails the gate.
- Old links with `?speed=` lose their speed; everything else they carry still applies.
- The unit suite drives runs slower; tests that drive a run to its end ask the pace control's top.
