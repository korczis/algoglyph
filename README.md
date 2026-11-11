# algoglyph

Algorithms and physics drawn as glyphs: a collection of generative visualisations and
interactive simulations, 2D and 3D, built on p5.js. Every plate is a live simulation with its
parameters exposed, seeded so that a URL reproduces the picture, and every number it shows is
measured from the running state.

## Plates

The registry (`src/plates/index.ts`) is the only list and numbers them in order.

| Category    | Plates |
|-------------|--------|
| Algorithms  | Sort Tapestry (ten sorting algorithms side by side), Maze & Flood (spanning-tree mazes, BFS), Cartographer (Dijkstra, A*, greedy over terrain), Murmuration (3D boids, uniform grid), Lloyd's Stained Glass (Voronoi relaxation), Avalanche Matrix (SHA-256 vs FNV-1a) |
| Mathematics | Rule Weaver (elementary cellular automata), Collatz Coral, Epicycle Engine (Fourier series), Escape Velocity (Mandelbrot and Julia sets) |
| Physics     | Chaos Fan (double pendulums, RK4), Foucault's Rosette (3D, rotating frame), Ripple Tank (wave equation, Young's double slit), Turing Garden (Gray-Scott reaction-diffusion), Magnet Weather (2D Ising model, Metropolis), Lorenz Butterfly (3D), Galactic Waltz (3D n-body, leapfrog), Verlet Cloth (3D) |

Keyboard: Space play/pause, `.` step, `R` reseed, `D` defaults, `S` PNG, `F` full screen,
arrows previous/next, `G` gallery, `T` theme.

## Development

```sh
npm ci            # also points git at .githooks (commit-msg, pre-commit, pre-push)
npm run dev       # http://localhost:5173
npm run verify    # the CI gate, locally; --fast skips the browser
```

Delivery is automated: every push to `main` runs `pages.yml` (CI, deploy to GitHub Pages,
verify that production serves the commit) on the self-hosted runner `lundra-algoglyph`
(ADR 0003). The same steps by hand, through the gh CLI:

```sh
npm run deploy:validate   # ci.yml on the current branch
npm run deploy            # pages.yml on main: validate, deploy, verify
npm run deploy:verify     # production serves origin/main and answers
```

Site: https://korczis.github.io/algoglyph/

| Layer        | Where |
|--------------|-------|
| Plate contract, stage, palettes, RNG | `src/core/` |
| Plates (pure algorithm module + `plate.ts`) | `src/plates/<name>/` |
| Shell (Flowbite Pro markup, Alpine state) | `index.html`, `src/main.ts`, `src/styles/app.css` |
| Unit tests (reference values, integrator invariants) | `test/` |
| Browser gate (axe WCAG 2.2 AA, console, overflow, every plate) | `scripts/audit-ui.mjs` |
| CI and Pages deploy with revision check | `.github/workflows/` |
| Supervision (rules, ADRs, policy) | `.ai/` (Majordomus) |

### Adding a plate

1. Put the algorithm or integrator in `src/plates/<name>/<module>.ts` and test it against an
   independent reference in `test/`.
2. Write `src/plates/<name>/plate.ts` exporting a `Plate`: parameters, notes, and `create()`
   returning `setup()`/`draw()`. Draw only through the context: `ctx.palette()`, `ctx.bg`,
   `ctx.fg`, `ctx.rnd`, `ctx.stats()`.
3. Register it in `src/plates/index.ts`. `npm run verify`.

The rules behind this are `project.viz-component-layer` and `project.no-fake-science` in
`.ai/repo/rules/project/`.

## Supervision

Supervised by [Majordomus](https://majordomus.dev): `majordomus context` before working,
`majordomus start` / `check` / `finish --verify-command "npm run verify"` around a task.
Agents start from `AGENTS.md` (Claude: `CLAUDE.md`, Gemini: `GEMINI.md`), all generated from
`.ai/repo/policy.yaml` by `majordomus update`.

## Licence

MIT, see `LICENSE`. Third-party notices in `NOTICE.md`.
