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
- The directory or file name is the catalogue entry's `id`; `src/registry.ts` joins them and
  numbering comes from the catalogue's taxonomy order, never from code.
- Randomness comes only from `ctx.rnd` or a `mulberry32` seeded from `ctx.seed`; a URL with
  `?seed=` reproduces the picture.
- Colours come from `ctx.palette()`, `ctx.bg` and `ctx.fg` (`src/core/palette.ts`).
- `draw()` never relies on `p.frameCount` (thumbnails run several frames per p5 frame), and
  work that would block a frame for long (a lab's scaling runs) is spread over frames.
- A parameter that changes the structure (grid size, counts, scene) sets `rebuild: true`.

# Failure behaviour

Code outside the stage that creates a p5 instance or canvas, a plate listed by hand, or code
without its catalogue entry is a blocking finding.

# Verification

`npm run catalogue -- --check` refuses code without an entry and a live entry without code;
`test/registry.test.ts` loads every live entry; the browser gate mounts every live plate and
lab. A reviewer checks the rest: `grep -rn "new p5\|createCanvas\|pixelDensity" src --include=*.ts`
must name only `src/core/stage.ts`.
