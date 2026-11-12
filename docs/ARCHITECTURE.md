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
| code shared by bespoke plates | `src/plates/_shared/<name>/` (no `plate.ts`, so never a plate) | imported |
| a bound on per-frame work | `cellWithin` / `stepsWithin` / `bounded` from `src/core/budget.ts` | `test/budget.test.ts` |
| a comparison | a `labs.yaml` entry; entries opt in with `labs: [<id>]` | the entries that name it |
| a chart | `ctx.chart({ title, x, y, series })` from any plate or engine | rendered by `src/core/charts.ts` |
| a heavy kernel | Rust in `crates/algoglyph-kernels`, a C ABI in `crates/algoglyph-kernels/src/wasm.rs`, a plate that imports `src/wasm/algoglyph_kernels.wasm?init` | built by `scripts/wasm.sh` |
| a classification level | a node in `taxonomy.yaml` (any depth) | the tree |
| a check of the facts gate | `tools/checks/<name>.rhai` defining `fn check(file)` + a refused fixture | file name; `algoglyph facts` |
| a task | a recipe in `justfile` with `[group]` and `[doc]` | `just --list` |

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

## Routes and shared links

`src/core/route.ts` parses every route in one place:

| Route | View |
|-------|------|
| `#/` | the collection |
| `#/c/<taxonomy path>` | a node of the taxonomy |
| `#/p/<id>?seed=<n>&<key>=<value>` | a plate |
| `#/lab/<id>?seed=<n>&<key>=<value>` | a lab, with the same query |

A route that does not resolve, including one with a malformed percent-encoding, opens the
collection. The query carries the seed and every parameter that differs from its default
(`src/core/share.ts`), so a copied link redraws the same picture. Values from a URL are
untrusted. A range value must be a plain decimal number; it is clamped into the range and
snapped to the slider's step. A select value must be one of its options, and a toggle must be
0, 1, true or false; anything else is dropped and the default stays. The seed must be a
decimal integer from 1 to `SEED_MAX`, the range `freshSeed()` draws from, so two links never
alias to one generator state. Every range default lies on its own grid, so opening a link never
moves a knob. `test/share.test.ts` round-trips every live entry and every runnable lab.

A plate may also offer `reset()` on its `Sim`. The stage then shows "Reset view" (key V), which
returns to the starting view without a rebuild. On a paused plate the stage runs a short burst
of frames (`src/core/loop.ts`), so a progressive render finishes before the pause holds again.
`mandelbrot-julia` uses it to undo zooms; it keeps a Julia parameter that was picked with the
pointer.

## Tooling

Three layers, each the entry point of the next (ADR 0005 §6):

1. **`just`** — the root `justfile` is where every task starts. `just --list` documents it:
   recipes are grouped (gates, catalogue, site, rust, delivery) and each carries a `[doc]`. A
   recipe delegates to the npm script or tool that does the work, so `just verify` and
   `npm run verify` cannot behave differently; `test/justfile.test.ts` reads `package.json` and
   the justfile and refuses an npm script no recipe runs, a recipe that runs a missing script or
   names a crate outside the workspace, and a `just <recipe>` in the docs that is no recipe. CI
   installs just, so the checks that read the justfile through just run there too.
2. **The CLI** — `crates/algoglyph-cli`, the binary `algoglyph`, a member of the Cargo workspace
   at the root beside `crates/algoglyph-kernels` (one lockfile, one release profile, build output
   in the ignored `target/`). The Node scripts are ported to it one at a time; each port is
   proven equivalent by running both on the same input, and the Node script stays the gate until
   its port replaces it. Ported so far: the derived-facts gate (`just facts-rs`), which reads
   the same `config/derived-facts.yaml`; `crates/algoglyph-cli/tests/equivalence.rs` runs both
   gates on the repository and on `test/fixtures/derived-facts/` and asserts the same findings,
   the same files read and the same exemptions applied to each.
3. **Rhai checks** — a check of the facts gate that is not built in is a script under
   `tools/checks/`, found by its file name: `tools/checks/<name>.rhai` is the check `<name>`,
   and the policy's exemptions apply to it by that name. The `plate-number` family is one. A
   check runs inside the limits of the policy's `rhai` block (operations, call depth, string,
   array and map sizes) and is refused with exit 2 when it reaches one; it cannot `import`
   another script, and its `print` and `debug` go to stderr, never into the `--json` report.

To add a check, drop a file there:

```rhai
// tools/checks/<name>.rhai: file.path, file.text, file.lines (#{ number, text }: derived
// regions blanked, YAML record subtrees left out); returns #{ line, text } per finding
fn check(file) {
    let found = [];
    for line in file.lines {
        for m in find_all(line.text, `\bTODO\b`, "i") {   // JavaScript regex syntax
            found.push(#{ line: line.number, text: m.text });
        }
    }
    found
}
```

then add a refused case to `test/fixtures/derived-facts/`: the equivalence test asks for one
per check. The host contract is documented in `crates/algoglyph-cli/src/plugins.rs`.

```bash
just                               # the recipes, by group
just catalogue                     # validate; print what the collection holds
just catalogue --check             # and refuse a stale derived plan
just catalogue stats               # counts by wing, engine and status
just catalogue list --status planned --engine graph
just catalogue new <id> --title "<t>" --taxonomy <wing/shelf> --engine <e> [--kernel]
just plan --write                  # regenerate the MC-*/IC-* plan from the planned entries
just wasm                          # Rust tests + wasm32 build
just readme                        # regenerate the README's derived regions
just facts                         # no hand-typed counts, plate numbers or dangling links
just facts-rs                      # the same gate, Rust port with the Rhai checks
just test-rs                       # every crate's tests, the port's equivalence included
just verify                        # everything CI runs, in CI's order
```

## Enforcement

| Rule | Checked by | Runs in |
|------|------------|---------|
| `project.catalogue-integrity` | `scripts/catalogue.mjs --check`, `build-readme.mjs --check`, the Vite plugin | verify, CI, every build |
| `project.derived-facts` | `scripts/check-facts.mjs` (policy `config/derived-facts.yaml`), `test/derived-facts.test.ts`; its Rust port's equivalence, `crates/algoglyph-cli/tests/equivalence.rs` | pre-commit, verify, CI; the port in CI |
| `project.viz-component-layer` | the live↔code check, `test/registry.test.ts`, the browser gate | verify, CI |
| `project.no-fake-science` | the engine harness tests, `cargo test`, the wasm fixture test | verify, CI |
| main-thread budget (`project.viz-component-layer`) | `test/budget.test.ts` over every live plate and lab: every width and heavy corner, past the end of a run, during a slider drag; CPU time calibrated by a reference workload; budgets in `config/budgets.yaml`; run alone (`npm run test:budget`) | verify, CI |
| `project.ui-quality-gate` | `scripts/audit-ui.mjs` (axe WCAG 2.2 AA, console, overflow, every plate, lab and thumbnail) | verify, CI before every deploy |
| the plan | `majordomus plan validate`, `majordomus doctor` | the commit hook, CI |
