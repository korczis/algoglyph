# Architecture

How algoglyph is put together, what is authored and what is derived, and where each part can
be extended. The decision behind it is ADR 0004
(`.ai/repo/adrs/0004-catalogue-in-frontmatter-multi-level-taxonomy-engines-kernel.md`); the
rules that hold it in place are `project.catalogue-integrity`, `project.viz-component-layer`,
`project.no-fake-science` and `project.ui-quality-gate` under `.ai/repo/rules/project/`.

## One source

```text
catalogue/                         authored: the only description of the collection
  taxonomy.yaml                    the classification tree, any depth, display order
  labs.yaml                        comparison labs: id, title, summary, engine
  sources.yaml                     cited works and practice areas
  entries/<id>.md                  one algorithm: front matter + summary + reading notes
        │
        ▼  scripts/lib/catalogue.mjs (one parser, one validator)
        │
        ├── virtual:catalogue      what the site ships (Vite plugin; an error fails the build)
        ├── README.md regions      scripts/build-readme.mjs
        ├── .ai/repo/project       MC-<wing> milestones, IC-<wing>-<engine> issues (plan)
        └── the browser gate       scripts/audit-ui.mjs reads what to prove from it
```

Nothing derived is edited by hand, and every derived file has a `--check` that fails when it
is stale.

## An entry

```yaml
---
id: quicksort-three-way            # = file name = route #/p/<id>
title: Quicksort, three-way partitioning
taxonomy: sorting/quicksort        # a leaf of taxonomy.yaml
status: live                       # live when its code exists, planned otherwise
engine: array                      # an engine, or custom for a bespoke plate
labs: [sorting]                    # labs.yaml ids; the lab's engine must match
sources: [{ id: sedgewick-aic, ref: 'Part 3: Sorting' }]
tags: [sorting, quicksort, duplicate keys]
complexity: linear when the number of distinct keys is constant
related: [quicksort]               # one way; the reverse link is derived
# optional: mode, interaction, motivation, order
---

The first paragraph is the summary (cards, search, social text).

Every further paragraph is a reading note on the plate's page.
```

Numbering follows the taxonomy (leaf order, then `order`, then title) and changes when the
taxonomy does; links use ids. A public tree never names a private repository, organisation or
path: the validator refuses home paths and source locators, and an untracked deny-list
(`~/.config/algoglyph/private-terms` or `$ALGOGLYPH_PRIVATE_TERMS`) adds names locally.

## Extension points

| To add | Write | Discovered by |
|--------|-------|---------------|
| an algorithm of an existing family | `src/kernels/<engine>/<id>.ts` exporting `kernel` + its entry | path; the engine's harness test runs it |
| a family (an engine) | `src/engines/<engine>/index.ts` exporting `engine: Engine` and a harness `test/kernels-<engine>.test.ts` | path; `ENGINES` in `scripts/lib/catalogue.mjs` names it |
| a one-off visualisation | `src/plates/<id>/plate.ts` with a default `PlateCode` + its entry (`engine: custom`) | path |
| a comparison | a `labs.yaml` entry; entries opt in with `labs: [<id>]` | the entries that name it |
| a chart | `ctx.chart({ title, x, y, series })` from any plate or engine | rendered by `src/core/charts.ts` |
| a heavy kernel | Rust in `crates/algoglyph-kernels`, a C ABI in `crates/algoglyph-kernels/src/wasm.rs`, a plate that imports `src/wasm/algoglyph_kernels.wasm?init` | built by `scripts/wasm.sh` |
| a classification level | a node in `taxonomy.yaml` (any depth) | the tree |

### Engine and kernel

An engine owns a family's input, drawing and measurement; a kernel is one algorithm and draws
nothing. The array engine shows the contract (`src/engines/array/`): a kernel works on the array
only through `ArrayOps` (`get`, `set`, `swap`, `less`, `lessAt`, `exch`, `aux`, `setAux`,
`range`), every operation is counted and recorded as a trace, and the plate replays the trace.
The readouts and the chart are counted from the trace, never asserted, and
`test/kernels-array.test.ts` runs every live array kernel on every input shape and size against
an independent reference, with a stability check for entries tagged `stable` and a
no-comparison check for entries tagged `non-comparison`.

A lab gives each kernel the same input and the same operation budget per frame, ranks them by
when they finish, and measures each one's work for n = 16 … 512, one size per frame, fitting the
growth exponent by least squares on a log–log scale.

### WebAssembly

Heavy kernels are written once in Rust (`crates/algoglyph-kernels`), the way majordomus-core is:
an rlib for native tests and a `wasm32-unknown-unknown` cdylib for the browser, with a plain C
ABI (handles, a few calls, views onto the module's memory) and no binding generator. The native
tests prove the kernel's invariants; `test/kernels-wasm.test.ts` proves the browser's build
reproduces the native build's fixture exactly. The `.wasm` is a build output and never
committed; `npm run dev`, `build` and `test` build it first.

### Charts

A plate publishes a declarative `Chart` (one y-axis, linear or log axes, named series of
points); the page renders it with Apache ECharts, loaded with the first chart, or as a table
of the same data. Categorical hues come in a fixed order validated against the shell's
surfaces in both themes; series past eight fold to a muted grey instead of a generated hue; a
legend appears from two series, direct labels up to four, and a crosshair tooltip always.

### Three.js

3D plates run on p5's WEBGL renderer today. The `three` mode is reserved in the catalogue
(`mode: three`) for engines whose scenes outgrow it; adding it means one renderer path in
`src/core/stage.ts`, which stays the only place a canvas is created.

## Tooling

```bash
npm run catalogue                  # validate; print what the collection holds
npm run catalogue -- --check       # and refuse a stale derived plan
npm run catalogue -- stats         # counts by wing, engine and status
npm run catalogue -- list --status planned --engine graph
npm run catalogue -- new <id> --title "<t>" --taxonomy <wing/shelf> --engine <e> [--kernel]
npm run catalogue -- plan --write  # regenerate the MC-*/IC-* plan from the planned entries
npm run wasm                       # Rust tests + wasm32 build
npm run readme                     # regenerate the README's derived regions
npm run facts                      # no hand-typed counts, plate numbers or dangling links
npm run verify                     # everything CI runs, in CI's order
```

## Enforcement

| Rule | Checked by | Runs in |
|------|------------|---------|
| `project.catalogue-integrity` | `scripts/catalogue.mjs --check`, `build-readme.mjs --check`, the Vite plugin | verify, CI, every build |
| `project.derived-facts` | `scripts/check-facts.mjs` (policy `config/derived-facts.yaml`), `test/derived-facts.test.ts` | pre-commit, verify, CI |
| `project.viz-component-layer` | the live↔code check, `test/registry.test.ts`, the browser gate | verify, CI |
| `project.no-fake-science` | the engine harness tests, `cargo test`, the wasm fixture test | verify, CI |
| `project.ui-quality-gate` | `scripts/audit-ui.mjs` (axe WCAG 2.2 AA, console, overflow, every plate, lab and thumbnail) | verify, CI before every deploy |
| the plan | `majordomus plan validate`, `majordomus doctor` | the commit hook, CI |
