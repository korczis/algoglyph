# RFC 0001 — A typed reactive DAG over the collection

Status: the first vertical slice is implemented (ADR 0011, rule `project.typed-flow`); the
roadmap in §H is proposed. Examined: algoglyph `origin/main` at
9bdb623cf5d2454a327176963ebf95cf69df3344, oscilla 7447efa04f7ce57c75692bfffbbc2dc18c6636b0
(local checkout, not fetched), both on 2026-11-15. Every claim below names the file it rests on;
a claim with no file is labelled a judgement.

## A. Verdict

**PARTIALLY, by incremental evolution, not by rewrite.** The computational cores already exist
as pure, testable code, and the platform's governance (catalogue, data validation, budgets,
browser gate) already holds the invariants a graph runtime needs. What is missing is not a
framework but four small contracts — a port type with units, a node definition, a validated
graph document and a command store — plus one change of habit: an engine's kernel must be
callable without its drawing. The slice in `src/flow/` proves this with real kernels, and it
needed no change to any plate, engine, kernel or the stage.

"Partially" because one family of the existing code cannot join without refactoring:

- **Reusable as typed processors today.** The array engine's instrumented `trace()`
  (`src/engines/array/trace.ts`) runs any array kernel on any key array and returns the sorted
  output and the counted operations. The signal kernels' radix-2 FFT (`src/kernels/signal/_fft.ts`)
  and the numeric linear algebra (`src/kernels/numeric/_linalg.ts`: Householder `lstsq`,
  `vandermonde`, `polyval`) are pure functions. The shared parser `src/core/data.ts` is already a
  typed, bounded table provider.
- **Reusable only after extraction.** Numeric, signal, geometry, graph and the other engines'
  kernels return a *drawing* (`NumericRun` of panels, steps and layers in
  `src/engines/numeric/trace.ts`), so their result is a picture, not a value. Each needs its
  algorithm split from its run builder — which most already do internally (helpers prefixed `_`).
- **Bespoke plates** (`src/plates/<id>/plate.ts`) own their state inside `create()`'s closure
  and expose only `pressed`/`dragged` mouse hooks (`src/core/plate.ts` `Sim`). They can join as
  sinks (an existing Plate preview) but not as bidirectional nodes until their state is lifted
  into a node's canonical state. That is a per-plate refactor, never a blanket one.

Thin adapter vs extraction vs rewrite: adapters over `trace()`, `fft()` and `lstsq()` suffice
for the slice; extraction (split run builder from algorithm) is the scalable path for the
drawing engines; a rewrite of Plate/Stage would discard the budget, pacing, claims and browser
gates that keep the collection honest and is rejected.

## B. Audit: what exists, what is missing, where the bottlenecks are

| Capability the hypothesis needs | Exists today | Evidence | Gap |
|---|---|---|---|
| Declarative metadata | yes: one entry per algorithm, schema-checked | `catalogue/schema/entry.yaml`, `scripts/lib/catalogue.mjs` | no port/computation facet |
| Typed input with units | yes, for reader data: columns with units and bounds | `src/core/data.ts` `DataDecl`, `DataColumn` | no type for values *between* computations |
| Parameters with constraints | yes: range/select/toggle, snapped, link-safe | `src/core/plate.ts` `ParamDef`, `src/core/share.ts` `snap` | reused as-is by the flow |
| Seeded determinism | yes | `src/core/random.ts` `mulberry32`, rule `project.viz-component-layer` | reused |
| Instrumented algorithms | yes, array engine | `src/engines/array/trace.ts` `trace`, `Counts` | other engines return drawings |
| Charts as data | yes: declarative `Chart` → ECharts | `src/core/charts.ts` `renderChart` | reused as the chart sink |
| Interaction | mouse hooks only | `src/core/plate.ts` `Sim.pressed/dragged` | no typed intent, no undo |
| Graph, ports, runtime | no | — | built in `src/flow/` |
| Privacy of reader data | yes, enforced | rule `project.user-data-stays-local`, `test/data.test.ts` | the flow inherits it (§11) |

Bottlenecks, in order of cost: (1) result-as-drawing in most engines; (2) state hidden in plate
closures; (3) `src/main.ts` is one Alpine component for every view, so a new surface must stay
out of Alpine's reactivity (the stage already does — `let stage` "not reactive on purpose").

What Oscilla contributes (reference, not template): one pure `canConnect` returning a readable
reason (oscilla src/js/studio/ports.js), Tarjan cycle refusal at every entry point
(src/js/studio/validate.js), dispatch → validate → freeze → history (src/js/studio/actions.js),
custom HTML cards over one SVG cable layer with no flow framework (its ADR 0034). The flow takes
the first three ideas and the editor approach; it does not take the four-signal-type table (a
WebAudio taxonomy), and it differs in two places: units are part of the type, and a cycle is
reported by name from Kahn's leftover set rather than Tarjan (one algorithm for order and
refusal).

## C. Formal model (as implemented)

The canonical schema is **TypeScript in `src/flow/`**, validated at run time by hand-written pure
functions — no Zod, TypeBox or JSON Schema dependency. Reason: the type system needs unit
variables and unification, which none of those express; the catalogue already uses its own
schema dialect (`catalogue/schema/entry.yaml`) and its own validator, so a second schema library
would be the competing source the brief forbids. A JSON Schema for the graph document can be
*generated* from these types when an external tool needs it (not built: no consumer yet).

```ts
// src/flow/types.ts — a port type; `$X` is a unit variable bound by the first edge into a node
type PortType =
  | { kind: 'series'; unit: Unit; index: Unit }        // Series<V, axis s> ≠ Series<V, axis Hz>
  | { kind: 'points'; x: Unit; y: Unit }
  | { kind: 'table'; columns?: { key: string; unit: Unit }[] }
  | { kind: 'record' };                                // measured readouts with units
function unify(out: PortType, inp: PortType, b?: Bindings): { ok: true; bindings } | { ok: false; reason };

// src/flow/node.ts — what a node is
interface NodeDef<S> {
  type; title; category: 'provider' | 'processor' | 'sink'; summary;
  entry?: string;                 // catalogue entry whose code it runs → title and link derived
  params: ParamDef[];             // the plates' own parameter contract
  inputs: PortDecl[]; outputs: PortDecl[];
  infer?(…): Record<string, PortType> | string;   // output types from params/state/input types
  state?: { initial(params): S; parse(raw): S | string };
  intents?: Record<string, { validate(state, payload, params): string | null; apply(…): S }>;
  side?: { label; bytes };        // attached text: in this tab only, its digest fingerprints the node
  view?: 'chart' | 'scatter' | 'readout' | 'export';
  seeded?: boolean;
  run(ctx: RunContext<S>): Outputs | Promise<Outputs>;
}

// src/flow/graph.ts — the persisted document (canonical text, versioned, bounded)
interface GraphDoc { schema: 'algoglyph.graph/v1'; seed: number; nodes: NodeInstance[]; edges: Edge[] }
check(doc, registry)      // → errors, topological order, resolved type of every output
canConnect(doc, edge, registry)   // the editor's preview, its refusal and the tests all call this
parseGraph(text, registry)        // bytes → JSON → depth → counts → ids → params → state → check

// src/flow/store.ts — the only writer
type Intent = node.add | node.remove | node.move | edge.add | edge.remove | param.set
            | { type: 'node.intent'; node; name; payload } | graph.load;
store.dispatch(intent, { origin, txn })  // reduce → check whole graph → commit or refuse, unchanged
```

Mapping to the brief's vocabulary: NodeDefinition = `NodeDef`; NodeInstance, GraphDefinition,
GraphRevision = `NodeInstance`, `GraphDoc`, `FlowStore.revision`; InputPort/OutputPort/PortType
= `PortDecl`, `PortType`; ParameterDefinition = `ParamDef` (unchanged from plates);
ValueEnvelope = `Value` (series carries its axis, points carry their `owner`); InteractionIntent
and StateTransition = `Intent` and `IntentDecl`; GraphExecution and ExecutionTrace = `Execution`
and `NodeTrace` (status, reason, cached, ms, fingerprint); ProviderDefinition and
RendererDefinition = a `NodeDef` of category provider or sink. No separate type exists where a
category of one suffices.

**The generic connection (built).** Port types follow from the *engine* contract, not the
entry: every grid kernel is `seeded instance → readouts + cells computed by row`, every graph
kernel `seeded graph → counts`, every sorting kernel `Series<$U> → Series<$U, axis 1> + Counts`.
So the connection is one adapter per engine (`src/flow/derive.ts`, `src/flow/adapters.ts`, the
array adapter in `src/flow/nodes.ts`): it reads the live catalogue and makes every entry of its
engine a choice of one family node, run by the engine's own headless runner, reporting the
engine's own measurement. An entry that goes live joins with no edit; no kernel id is typed in
code. Writing ports into each entry's frontmatter would copy one engine fact into every file, so
the frontmatter carries nothing new; a `flow:` key is added only when an entry has to deviate
from its engine's projection, and none does yet.

Declared / derived / inferred / validated / enforced, as built, for every live entry
(`coverage()` in `src/flow/derive.ts`, shown in the editor's *Catalogue coverage* panel, computed
on each open and never stored):

- **declared** — a node written in `nodes.ts` names the entry it runs (`entry`): the spectrum
  node runs the FFT entry, the fit node the least-squares entry;
- **derived** — an engine adapter accepts the entry: the sort node (array) and the table and
  board (grid), graph, tree and heap (tree), string and text (string) and hash table (hash)
  kernel nodes, the signal processing and the stochastic kernel nodes, each a select over the
  catalogue's own entries, linking the chosen entry's plate;
- **inferred** — no adapter runs it. The reason is computed: a bespoke plate keeps its
  computation inside its drawing; an adapter refuses it (a selection kernel has no `k` port);
  or the engine has a headless runner in the source tree (`src/engines/*/{trace,sim,table}.ts`, read
  by glob), in which case a node is *proposed* (seeded provider → counts) but not built. An
  inferred entry is never runnable; adding an adapter promotes its engine's entries, and the
  tests then validate every promoted run.

A CSV schema read from a header is inferred the same way: a proposal with every unit `1` until
the reader approves it (`inferSchema`, then the `schema` intent). Output types are **validated**
by `check` and again by the runtime against each produced value; cycles, unit mismatches,
malformed imports, invalid intents, a family node whose type is not its adapter's and two
adapters for one engine are **enforced** by refusal (tests in §14).

## F. Compatibility and migration matrix

Grounded in `src/engines/*/index.ts`, `src/kernels/*/` and `src/registry.ts`. Counts are not
written here (rule `project.derived-facts`); list them with `npm run catalogue -- list`.

| Family | Core API | Category | Strategy | First node |
|---|---|---|---|---|
| array (incl. compiled sorting kernels via sidecar) | `ArrayKernel.run(ops)`, `trace()` | **derived processor** | array adapter (done); selection kernels inferred until a `k` port exists | Sort, every live sorting entry |
| grid | `GridKernel.instance(n, seed)`, `run()`, `Measure` readouts | **derived provider** | grid adapter (done) | Table and board kernel, every live grid entry |
| graph | `GraphKernel.steps`, `makeGraph`, `trace()`, `Counts` | **derived provider** | graph adapter (done); a graph value kind for graph *inputs* is still not built | Graph kernel, every live graph entry |
| numeric | `NumericKernel.run(inp) → NumericRun` (drawing) | extraction | split algorithm from run builder; helpers already pure (`_linalg`, `_functions`) | Polynomial fit (done, via `_linalg`) |
| signal | `_fft.ts`, windows; `SignalKernel.run(params, seed, meter)` | processor via helpers, **derived provider** | spectrum over `_fft.ts` (declared); signal adapter: the metered counts of the whole run (done) | Magnitude spectrum; Signal processing kernel, every live signal entry |
| geometry | trace + worker | extraction | expose hull/Voronoi as `points → points` | convex hull |
| tree | `TreeKernel.run`, `workload()`, `trace()`, `Counts` | **derived provider** | tree adapter (done) | Tree and heap kernel, every live tree entry |
| string | `StringKernel.run`, `input()`, `trace()`, its own counters | **derived provider** | string adapter (done) | String and text kernel, every live string entry |
| hash | `HashKernel`, the shared `workload()`, `trace()`, `Counts` | **derived provider** | hash adapter (done); the plate's defaults are one exported constant both read | Hash table kernel, every live hash entry |
| stochastic | `StochasticKernel.run` generator, `trace()`, draws/evals, chart series | **derived provider** | stochastic adapter: counts and the run's own chart series as points (done) | Stochastic kernel, every live stochastic entry |
| systems | time-stepped network sims | simulation mode (§7 below) | not in the finite runtime | — |
| bespoke plates | `PlateCode.create` closure | sink now; bidirectional after state lift | per plate, by ADR | `least-squares`-style plates first |

Standalone pages, gallery, links, seeds, claims, pacing and budgets are untouched: the flow
imports kernels, it never changes them, and the full suite (`npm run verify`) guards them.

## G. Proof of concept (built)

Smallest slice that proves the architecture, in `src/flow/`:

- **Real provider:** a reader's CSV, read by `src/core/data.ts` under a schema the reader
  approves; seeded keys from the array engine's `input()`; a sampled signal; a point set.
- **Typed connections:** units unify; `Series<…, axis Hz>` into a chart of `axis s` is refused
  with "axis in Hz where s is expected: no implicit unit conversion".
- **Existing kernels:** every live sorting kernel through `trace()`; the FFT of the signal
  plates; the least-squares plate's Householder QR.
- **Measured output:** compares, writes, swaps (counted by the trace), spectrum amplitudes, fit
  coefficients with derived units, RMS residual, R², summary statistics.
- **Reverse interaction:** drag a point (or focus it and press an arrow key) → `node.intent`
  `move` to the owning node → store validates the bounds → new revision → the fit, curve and
  readouts recompute → Undo restores the exact previous fit.

The four examples share one registry, one validator, one store and one runtime; none has code
of its own.

## H. Roadmap (proposed)

Ordered by dependency; each step leaves every standalone page working.

1. **Done — finite core.** Types, validator, store, runtime, adapters, editor, gate. Evidence:
   §14 ledger.
2. **Kernel extraction, one engine at a time** (numeric first). Prereq: 1. Scope: split
   `run()` into `compute(input) → value` and `draw(value) → NumericRun`, the plate calling both.
   Acceptance: the plate's claims and budget tests unchanged; a flow node per extracted kernel
   whose output matches the plate's readout. Risk: pacing depends on run shape — keep `build()`
   generators intact.
3. **Done — generic derivation.** Engine adapters derive family nodes from the catalogue; every
   live entry is declared, derived or inferred (`test/flow-derive.test.ts`, gate `flow`): array,
   grid, graph, tree, string, hash, signal and stochastic. Next: numeric, systems and geometry,
   whose kernels return drawings or run as time-stepped simulations — each needs its compute
   split from its run (step 2) or the simulation mode (step 7) before an adapter can report a
   measurement rather than a picture. A frontmatter `flow:` facet
   only when an entry must deviate from its engine's projection.
4. **Plate as sink.** A sink node that mounts an existing plate through the stage with
   parameters bound from a record input. Acceptance: one stage-owned canvas per visible preview,
   at most one live preview animating (WebGL context budget).
5. **State lift for one bespoke plate** (bidirectional plate). Prereq: 4. Acceptance: its
   `dragged()` becomes an intent; the standalone page and the flow share one state contract.
6. **Workers.** Move `Runtime.run` to a worker for heavy nodes (transferable `Float64Array`s).
   Acceptance: a measured main-thread budget under `config/budgets.yaml`, never a claimed one.
7. **Simulation mode.** A separate executor for time-stepped nodes: one clock owned by the
   runtime, explicit step/pause/reset/snapshot, the finite DAG downstream of each step.
8. **Stream mode** (HTTP poll, WebSocket). Bounded ring buffer with a declared drop policy and a
   counted drop readout; reconnect with backoff; recording to make a run replayable. Only `wss:`
   and `https:` URLs a reader types; no credentials in a graph or a link.
9. **Editor UX**: multi-select, minimap, clipboard, dagre layout — each when a measured need
   appears.
10. **AI-native authoring** (natural language → graph, MCP). Only on top of 1–3: a model may
    *propose* a `GraphDoc`; `parseGraph` and `check` decide, exactly as for an import.
    The gate it goes through is built: `npm run flow -- check -` (`src/flow/cli.ts`) parses and
    checks a proposed document from standard input and exits 1 with the refusals; `nodes`,
    `coverage` and `preset` give a model the registry, the catalogue's levels and starting
    documents as JSON; `run` executes a graph headless (`test/flow-cli.test.ts`).

## I. Minimal viable architecture

Four abstractions unlock most of the capability: **PortType with units + unify**, **NodeDef**,
**GraphDoc + check**, **FlowStore of intents**. The runtime is a loop over `check`'s order with a
fingerprint cache; the editor is a projection. Explicitly **not** built yet: streams and
WebSocket/HTTP providers, simulation clock, workers, a schema library, generated JSON Schema,
plate-as-node adapters, minimap, multi-select, ELK, frontmatter `flow:` facet, any AI planner.

## J. Critical assessment of the hypothesis

- *"Generic processing runtime"* is a trap if it means one executor for batch, simulation and
  streams. Their semantics differ (who owns time, what replay means, whether a value is final).
  The slice has one **finite** executor and names the other two as separate modes.
- *"Bidirectional"* is the wrong word for the graph. The graph is one-directional; the *store*
  is what interaction writes to. Calling a sink→source wire "bidirectional" would hide a cycle.
- *"Declarative metadata derives the ports"* is mostly false for this repository: ports derive
  from engine contracts. Metadata per entry is needed only for exceptions.
- *Units* are where the scientific value is — and where the hidden complexity is. String
  equality plus variables is deliberately weak: no dimensional algebra (m/s · s = m), no
  scale conversion (ms vs s). Both are refused, never coerced; an explicit conversion node is
  the fix, and a units algebra waits for a real need.
- *False economy:* adopting an editor library to save editor work moves the work into
  accessibility and a second compatibility table.
- *Risk:* the runtime runs on the main thread. Every node is bounded (`VALUE_LIMITS`, sort's
  `maxN`, CSV byte and row caps), but no budget test covers a whole graph yet (§14, G25).

## Security and browser constraints (§12)

All protections are browser-side; there is no server boundary and none is claimed. A graph
document: 64 KB, depth 8, bounded counts, ids by pattern, every parameter re-validated, unknown
keys refused, then `check` (`LIMITS`, `parseGraph`). A link carries the canonical document as
base64url and passes the same parser. A reader's CSV: 256 KB and 4096 rows, read by the shared
parser; it is held in the editor's memory only and never enters the document, the link or
storage — the link carries the approved schema (keys and units), never a value; the gate
verifies this and that no request leaves the page. Values: series, points and records are
capped (`VALUE_LIMITS`); a node that returns another type than it declared is an error. Markup:
the editor sets only `textContent` and values (boundary test). HTTP/WebSocket are not
implemented; when they are, they are subject to CORS (no proxy exists or is promised), carry no
secrets in a graph or link, and record what they received if a run is to be replayed.

## 14. Readiness ledger (gates of the prompt pack, G01–G28)

DECLARED = written in a contract; IMPLEMENTED = code exists; TESTED = a test fails when broken;
VERIFIED = run in the gate on this branch; ENFORCED = a blocking gate refuses it; DEPLOYED = on
Pages. "—" means not reached; nothing is marked without its evidence.

| Gate | State | Evidence |
|---|---|---|
| G01 authority (no manual node list duplicating the catalogue) | ENFORCED | family nodes derived by engine adapters (`src/flow/derive.ts`); `test/flow-derive.test.ts`: choices equal the catalogue's, an entry going live joins, every live entry at one level; gate `flow`: a derived node runs a second kernel and links its plate |
| G02 stable identity | ENFORCED | id pattern, duplicate refusal: `test/flow-graph.test.ts` |
| G03 structural validity | ENFORCED | bytes/depth/counts/params: `test/flow-graph.test.ts` "refuses malicious or malformed" |
| G04 type safety, units | ENFORCED | `unify` matrix, Hz vs s: `test/flow-graph.test.ts`; browser: gate `flow` refusal check |
| G05 direction, single input | ENFORCED | `input-taken`, self-loop: `test/flow-graph.test.ts` |
| G06 acyclic, deterministic order | ENFORCED | 200 seeded DAGs, named cycle: `test/flow-graph.test.ts` |
| G07 runtime isolation | ENFORCED | headless runs in vitest; no DOM in headless files: `test/flow-boundaries.test.ts` |
| G08 reuse of real kernels | TESTED | sort vs `Float64Array.sort`, FFT vs direct DFT, fit vs normal equations; every grid and graph kernel reports its engine's own measurement (`test/flow-derive.test.ts`) |
| G09 provider stays local | VERIFIED | gate `flow`: no request leaves the page; no value in the link |
| G10 provider bounded | TESTED | shared parser, row/column errors: `test/flow-runtime.test.ts`; byte cap before read in `studio.ts` |
| G11 HTTP safety | — | not built (§H step 8) |
| G12 WebSocket safety | — | not built (§H step 8) |
| G13 invalidation | TESTED | exact re-run sets: `test/flow-runtime.test.ts` "re-runs exactly" |
| G14 cancellation | TESTED | superseded run returns null: `test/flow-runtime.test.ts` |
| G15 canonical state | TESTED | views read store values; boundary test refuses direct writes |
| G16 bidirectional | VERIFIED | unit round trip + gate `flow`: keyboard move changes R² |
| G17 atomic rejection | TESTED | invalid intents leave text, revision, history unchanged |
| G18 undo/redo | VERIFIED | unit test restores the exact fit; gate `flow` Undo restores R² |
| G19 share round trip | TESTED | every example through a link, canonical text equal |
| G20 privacy of exports | VERIFIED | document never holds table values (unit + gate) |
| G21 regression | VERIFIED at finish | `npm run verify` (task finish record) |
| G22 keyboard | VERIFIED | ports are buttons, inspector menus; gate moves a point by keyboard |
| G23 themes and mobile | VERIFIED | gate `flow`: dark/light × 390/1440, axe on every example and the inspector |
| G24 scientific | TESTED | independent references above |
| G25 performance budget | — | per-node caps only; no whole-graph budget test yet |
| G26 derived docs fresh | ENFORCED | existing catalogue/README/facts gates, unchanged |
| G27 enforcement reachability | DECLARED | rule `project.typed-flow` names its gates; Majordomus reachability not proven here |
| G28 deployed | see the task's finish record | Pages serves `revision.txt`; marked only after it matches |
