---
id: project.viz-component-layer
version: 2
kind: rule
title: Every visualisation is a plate on the shared stage, discovered from its path
description: Visualisations exist only as engine kernels or bespoke plates, found by convention and joined with their catalogue entry; only the stage creates p5 instances, sizes canvases, pauses them and picks the ground colours.
statement: Add a visualisation as a kernel src/kernels/<engine>/<id>.ts for an existing engine, or as a bespoke plate src/plates/<id>/plate.ts with a default export, drawing only through the PlateContext it is given; never list it by hand, and never call `new p5`, createCanvas, pixelDensity or choose a background colour outside src/core/stage.ts and src/core/palette.ts.
status: active
class: blocking
depends_on: [fleet.ui-uses-flowbite-pro@1]
tags: [ui, visualization, accessibility, p5, catalogue]
---

# Rationale

One layer owns what every plate needs alike: canvas size from the host and aspect ratio,
pixel density, pausing by hand, off screen (IntersectionObserver) and under
`prefers-reduced-motion`, stepping, PNG export, `role="img"` with a label, seeded randomness,
light/dark grounds and the gallery thumbnails. A plate that does any of this itself breaks
one of them silently. Version 2 (ADR 0004): the registry is discovered, so a list kept by
hand can no longer disagree with the code, and a family of algorithms shares one engine.

# Required behaviour

- An engine (`src/engines/<engine>/index.ts`) turns a kernel into a plate and several into a
  lab; a kernel holds the algorithm only, working through the engine's instrumented
  operations, so its readouts are counted from its own run.
- A bespoke plate is `src/plates/<id>/plate.ts` with a default `PlateCode` export; pure
  algorithm or integrator code lives beside it in its own module so it can be unit tested.
  Code shared by several bespoke plates lives in `src/plates/_shared/<name>/`, which has no
  `plate.ts` and so is never discovered as a plate; a plate never imports another plate, which
  `test/plate-boundaries.test.ts` checks for every file under `src/plates/`.
- The directory or file name is the catalogue entry's `id`; `src/registry.ts` joins them and
  numbering comes from the catalogue's taxonomy order, never from code.
- Randomness comes only from `ctx.rnd` or a `mulberry32` seeded from `ctx.seed`; a URL with
  `?seed=` reproduces the picture.
- Colours come from `ctx.palette()`, `ctx.bg` and `ctx.fg` (`src/core/palette.ts`).
- `draw()` never relies on `p.frameCount` (thumbnails run several frames per p5 frame), and
  work that would block a frame for long (a lab's scaling runs, a direct-summation force pass,
  the next run of a loop) is spread over frames. A plate fits the main-thread budget of
  `config/budgets.yaml`, proven by `test/budget.test.ts` for every live plate and lab, in three
  checks derived from its own controls: creation and the first frames at every width and every
  heavy corner (each range at its maximum and, in turn, at its minimum; each select option); the
  frames past the end of a run, where a loop rebuilds, for every option of each select that
  changes the work (a parameter that only changes the look is marked `cosmetic`, as palettes
  are); and a slider dragged without a remount. An array kernel too costly to trace in one frame
  at the engine's largest input declares `maxN`, derived from its measured cost, and its slider
  (and every lab it races in) stops there.
  The gate counts CPU time, calibrated against a fixed reference workload, so it judges the
  plate's work and not the machine's speed or load; each repeat takes a new seed, so a cache
  never answers for the work; outside CI the budgets carry `local_headroom`, so a plate that
  passes on a developer's machine passes on CI's runners.
- A frame's share of a run is counted, never only timed: a wall-clock slice always finishes the
  step it started, and under load a frame's CPU outgrows its wall time. Engines that resume a
  run per frame bound it by a count (graph `FRAME_UNITS`, signal `STEPS_PER_FRAME`, stochastic
  `PIECES_PER_FRAME`, grid `BUILD_EVENTS_PER_FRAME`); a kernel whose units cost more than the
  engine's flat unit declares it (a graph kernel yields the uncounted work it did, a grid kernel
  whose events resume a deep recursion sets `eventCost`).
- A lab never puts two heavy pieces of work in one frame: it traces at most one kernel a frame,
  shows a new generation's panes on a frame that traces nothing, and measures no size larger than
  the input its slider allows (`test/engine-array-lab.test.ts` counts the traces per frame).
  Readout counts go through `src/core/format.ts` (`count`), one `Intl.NumberFormat` made once.
- Correctness tests are not judged on wall-clock time: no test sets a limit shorter than the
  suite's `testTimeout`, and a Rust test's time bound is only a hang guard of at least 30 s
  (`test/suite-contract.test.ts`); time is judged only by the budget gate, in CPU time.
- Work that grows with the canvas or with the steps asked per frame is bounded with
  `src/core/budget.ts` (`cellWithin`, `stepsWithin`), and the readout says what was done
  (`bounded`): a bounded quantity is never shown as the value asked. A state that decays
  towards zero (a dying reaction, a damped wave) is stored through `flush`, so it never sits in
  subnormal floats, which x86 processors compute far slower than Apple silicon; a test of the
  plate's module proves its decayed state holds no subnormal value.
- A parameter that changes the structure (grid size, counts, scene) sets `rebuild: true`.

# Failure behaviour

Code outside the stage that creates a p5 instance or canvas, a plate listed by hand, or code
without its catalogue entry is a blocking finding.

# Verification

`npm run catalogue -- --check` refuses code without an entry and a live entry without code;
`test/registry.test.ts` loads every live entry; the browser gate mounts every live plate and
lab. A reviewer checks the rest: `grep -rn "new p5\|createCanvas\|pixelDensity" src --include=*.ts`
must name only `src/core/stage.ts`.
