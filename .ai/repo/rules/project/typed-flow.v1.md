---
id: project.typed-flow
version: 1
kind: rule
title: A flow is a typed, acyclic document changed only by validated intents
description: Every flow edge passes the one validator, units never coerce, a cycle is refused by name, a view changes state only by an intent to the node that owns it, the model and runtime run without a DOM, and nodes that run catalogue kernels are derived from the catalogue, never listed by hand.
statement: Change a flow only through src/flow/store.ts intents, which src/flow/graph.ts check() accepts as a whole graph before commit; decide port compatibility only with unify/canConnect (units exact, `$` variables per node, no coercion), refuse every cycle by naming it, let views send intents to the node that owns the state and never write values back along an edge, keep src/flow's model, store, runtime and nodes free of the DOM, network and storage, implement a node by adapting an existing kernel, never by copying it, and let an engine adapter (src/flow/adapters.ts, the array adapter in src/flow/nodes.ts) derive the kernels a node offers from the live catalogue, so every live entry is declared, derived or inferred (src/flow/derive.ts) and an inferred entry is never runnable.
status: active
class: blocking
depends_on: [project.viz-component-layer@2, project.no-fake-science@1, project.user-data-stays-local@1, project.ui-quality-gate@1]
tags: [flow, types, dag, interaction, privacy]
---

# Rationale

A graph editor is persuasive in a way a plate is not: a cable looks like a computation whether
or not one happens. ADR 0011 makes the flow a validated document, puts units into the type and
routes interaction through intents so the computation stays acyclic. Each of those is easy to
erode one convenient shortcut at a time — a second compatibility check in the editor, a view
that patches a value in place, a node that re-implements a kernel "just for the graph".

# Required behaviour

- One validator: `check()` and `canConnect()` in `src/flow/graph.ts`; the editor, the importer,
  the link decoder, the store and the runtime call it, and nothing else decides compatibility.
- Units compare exactly; a conversion is a node. A mismatch is refused with both units named.
- A cycle is refused at every entry point (edge, import, link, load) and never repaired.
- The store refuses an intent that fails its node's validation or leaves an invalid graph, and
  the document, revision and history are then unchanged.
- A view's only write is an intent addressed to the node that owns the state.
- `src/flow/` model, store, runtime, nodes and presets name no DOM, network, storage or
  code-loading API; the editor names no network or storage API and writes no markup from text.
- A node that computes calls an existing kernel or shared helper; a node's numbers are tested
  against an independent reference (rule `project.no-fake-science`).
- A reader's table stays out of the document and every link (rule `project.user-data-stays-local`).
- Kernels reach the flow by derivation (RFC §5): one adapter per engine turns every live entry of
  that engine into a choice of one family node, read from the catalogue; no list of kernel ids
  is written in code. An adapter states what it refuses and why.
- Every live entry is accounted for at exactly one level, computed and never stored: declared (a
  node in nodes.ts names it), derived (an adapter runs it) or inferred (no adapter runs it; the
  reason and, where the code suggests one, a proposed node). An inferred entry is never runnable;
  it becomes derived only by an adapter whose runs the tests validate.
- A derived node reports what its engine measures for the same instance, never a number of its
  own.
- What an addition owes is read from the tree, not from a list: every adapter in `ADAPTERS` has
  a test that runs its node against its engine and a derived row in the RFC's migration matrix,
  and every command of `scripts/flow.mjs` is in its help and in docs/ARCHITECTURE.md.
- A kernel reads a caller's data only through a form it declares (a graph kernel the graph form,
  a grid kernel `fromData`, any other a `DataForm` of `src/core/solve.ts`): the kernel validates
  the data itself, refuses with the field named and answers with the plate's own code. The
  command line finds every form from the kernels; each one owes a reference test.

# Failure behaviour

`npx vitest run` fails on `test/flow-graph.test.ts` (unify matrix, cycle naming, deterministic
order, malformed and malicious documents, canonical round trips), `test/flow-runtime.test.ts`
(intent round trip and refusal, undo/redo, incremental re-runs, cancellation, kernels against
references, table privacy), `test/flow-derive.test.ts` (every live entry at one level, choices
equal to the catalogue's, an entry going live joins and one parked leaves, inferred never
runnable, an added adapter promotes its engine, every grid, graph, tree, string, hash, signal and
stochastic kernel reporting its engine's own measurement, every selection kernel against a sorted
copy) `test/flow-obligations.test.ts` (an engine adapter without a test that runs its node, or
without a derived row in the RFC's migration matrix; a command-line command missing from its help
or from docs/ARCHITECTURE.md; a kernel with a data form that `test/flow-cli.test.ts` never runs), `test/flow-cli.test.ts` (the command line accepts and refuses exactly what the
editor does and exits non-zero on a refusal) or `test/flow-boundaries.test.ts` (DOM, network, storage and markup
boundaries; views write only intents). `node scripts/audit-ui.mjs` fails its `flow` section when
an example does not run or a node fails, a refused connection is drawn or not explained, a
keyboard move does not change the fit or Undo does not restore it, a request leaves the page
while a table is attached, the link carries a table value, a derived node offers fewer than two
kernels or a chosen one does not run or link its plate, the coverage panel lists other than its
tally, or axe finds a violation. Each blocks
`npm run verify` and CI.

# Verification

`npx vitest run test/flow-graph.test.ts test/flow-runtime.test.ts test/flow-derive.test.ts test/flow-boundaries.test.ts`
and `node scripts/audit-ui.mjs --only flow`; a reviewer checks that a new node adapts an
existing kernel and cites its reference test.
