---
schema: adr/v1
id: adr-0010
kind: adr
title: "A reader's own data: declared per plate, read in the browser only, carried by a link when small"
status: proposed
date: 2026-11-12
tags:
  - data
  - privacy
  - catalogue
  - share
provenance:
  origin: authored
---

# 10. A reader's own data: declared per plate, read in the browser only, carried by a link when small

## Context

The owner's standing order for the collection, in session 8b702ebf-3f15-4e77-880e-843436e75d2c on
2026-11-12, verbatim: "data driven, data upload allowed and implemented where possible". Every
plate ran on seeded synthetic input only. Many of them answer a question a reader has about their
own numbers: a fit through their points, the hull of their positions, the sort of their keys.

The planning lane mapped where upload is meaningful (every engine with an input select, and the
bespoke plates whose input is a table, a series or a mask). The coordinator decided the contract
in the same session:
- adopt a per-plate `data` field;
- validate in the browser only (src/core/data.ts);
- prove network silence with a test and with the browser gate;
- carry small data in the URL fragment and re-validate it on open; leave only a digest for large
  data;
- have the page say plainly "a copied link carries your data" whenever it does.

The first adopters are `least-squares` and the geometry engine's point input. The array engine's
keys were to follow if they fitted; they are deferred, because most array kernels are compiled
(the sorting sidecar) and their assumptions about the range of keys are not yet checked.

The site is static (ADR 0001): there is no server that could receive anything, and the fragment
of a URL never leaves the browser. So the privacy question is not where the data goes. It is what
a reader hands on when they copy a link.

## Decision

1. **Declared per plate in its catalogue entry.** An entry may carry `data`, a list of inputs
   (catalogue/schema/entry.yaml). Each input has:
   - an id;
   - a title;
   - a kind (`table`, or `series` for a single column);
   - the formats it accepts (`csv`, `json`);
   - its columns, each with a key, a **unit** and optional bounds;
   - the rows it accepts (`min`, `max`);
   - a byte cap;
   - `replaces`, the key of the plate's select that gains the option `data:<id>`;
   - `ignores`, the controls that only shape the seeded input: the page disables them while the
     data is picked and says why, and a test proves that they change nothing on data;
   - `url_bytes`, the longest encoded table a link carries.

   The registry adds the option when it joins code and entry. A kind that has no parser is not in
   the schema's enumeration.
2. **Read in the browser only.** src/core/data.ts is pure and src/core/upload.ts reads files.
   - The byte cap is applied before any parse; a file larger than the cap is not read at all.
   - Numbers use the DECIMAL grammar of src/core/share.ts and must be finite and inside their
     column's bounds.
   - JSON is parsed without a reviver, and only arrays, objects and numbers are accepted.
   - Every refusal names its row (the line of the text, or the item of the array) and column.
     The first twelve are listed and the rest are counted.

   Neither file names a network, storage or code-loading API (test/data.test.ts). The browser
   gate attaches data to a plate and finds no request leaving the page's origin.
3. **One canonical form and one digest.** A table is kept as a canonical CSV: a header of the
   declared keys, then numbers in JavaScript's shortest round-trip text. Its digest is the SHA-256
   of that text. It is computed synchronously, by an implementation tested against node:crypto,
   so the link is written in the same tick as the change.
4. **The link.**
   - A table whose base64url encoding fits `url_bytes` rides in the fragment as `d.<id>=<token>`,
     next to `shape=data:<id>` (or whichever select it replaces).
   - Opening that link decodes the token and validates it with the same parser as a file.
   - A larger table leaves `d.<id>=~<rows>.<first 16 hex of the digest>` and nothing of its
     values. The page that opens such a link runs the default input and says it was made with a
     local file of that many rows. When the reader attaches a file, the page says whether it is
     the same data.

   The page says "a copied link carries your data" whenever the link carries it, and "a copied
   link does not carry your data" otherwise. Nothing is persisted: no localStorage, sessionStorage
   or IndexedDB.
5. **Evidence stays on seeded input.** Claims (ADR 0007), pacing (ADR 0008) and labs never run on
   a reader's data. A plate shows "Your data" while it reads one, and its readouts stay measured
   from the run. A reader's data is an input like any other: its run is paced by the same contract.
6. **The budget holds at the declared maximum.**
   - `rows.max` is the largest input the plate already handles within config/budgets.yaml.
   - The budget gate (test/support/budget.ts) runs each corner whose select picks `data:<id>` on
     a synthetic table of `rows.max` rows, and holds it to the same creation and frame budgets.
   - test/registry.test.ts checks that `replaces` names a select of the plate.

## Alternatives rejected

- **Uploading to a service or storing the data for later.** The site has no server, and a stored
  copy is data the reader did not ask to keep.
- **One generic upload contract with no per-plate declaration.** Units, bounds and sizes differ
  per plate; a plate that cannot use a table would offer it anyway.
- **Compressing the link (CompressionStream).** It is asynchronous and a second encoding to test.
  The digest marker already handles large data honestly.
- **Running claims on uploaded data.** A claim's expectation is about the seeded run it names; a
  reader's data has no known truth.
- **Silent truncation of an oversize file.** The reader would see a result about data they did not
  give.

## Consequences

- Adopting a new plate means adding the declaration to its entry and having the plate read
  `ctx.data(id)` when its select picks `data:<id>`. One adoption per engine reaches every kernel
  of that engine whose entry declares it.
- A link to a plate with a reader's data is longer by at most `url_bytes`, and readable by anyone
  it is sent to; the page says so where the link is copied.
- New kinds (netlist, mask, audio, matrix) each need their parser, tests and schema value before
  any entry may declare them.
- Rule project.user-data-stays-local holds the contract.
