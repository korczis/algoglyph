---
id: project.viz-component-layer
version: 1
kind: rule
title: Every visualisation is a Plate on the shared stage
description: Visualisations exist only as Plate objects in the registry; only the stage creates p5 instances, sizes canvases, pauses them and picks the ground colours.
statement: Add a visualisation as a Plate under src/plates/<name>/ registered in src/plates/index.ts, drawing only through the PlateContext it is given; never call `new p5`, createCanvas, pixelDensity or choose a background colour outside src/core/stage.ts and src/core/palette.ts.
status: active
class: blocking
depends_on: [fleet.ui-uses-flowbite-pro@1]
tags: [ui, visualization, accessibility, p5]
---

# Rationale

One layer owns what every plate needs alike: canvas size from the host and aspect ratio,
pixel density, pausing by hand, off screen (IntersectionObserver) and under
`prefers-reduced-motion`, stepping, PNG export, `role="img"` with a label, seeded randomness,
light/dark grounds and the gallery thumbnails. A plate that does any of this itself breaks
one of them silently.

# Required behaviour

- A plate is `src/plates/<name>/plate.ts` exporting a `Plate` (`src/core/plate.ts`); pure
  algorithm or integrator code lives beside it in its own module so it can be unit tested.
- The registry order in `src/plates/index.ts` is the plate numbering; numbers are never
  written by hand.
- Randomness comes only from `ctx.rnd` or a `mulberry32` seeded from `ctx.seed`; a URL with
  `?seed=` reproduces the picture.
- Colours come from `ctx.palette()`, `ctx.bg` and `ctx.fg` (`src/core/palette.ts`).
- `draw()` never relies on `p.frameCount` (thumbnails run several frames per p5 frame).
- A parameter that changes the structure (grid size, counts, scene) sets `rebuild: true`.

# Failure behaviour

Code outside the stage that creates a p5 instance or canvas, or a plate missing from the
registry, is a blocking review finding.

# Verification

`test/registry.test.ts` checks the registry (numbering, unique ids, defaults inside their
controls); the browser gate mounts every registered plate. A reviewer checks the rest:
`grep -rn "new p5\|createCanvas\|pixelDensity" src --include=*.ts` must name only
`src/core/stage.ts`.
