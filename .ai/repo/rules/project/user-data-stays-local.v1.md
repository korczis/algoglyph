---
id: project.user-data-stays-local
version: 1
kind: rule
title: A reader's own data is declared, validated in the browser and never sent
description: A plate accepts a reader's data only as its catalogue entry declares it, reads it in the page with the shared validator, never sends or stores it, and says whenever a copied link carries it.
statement: Accept a reader's data only through an entry's `data` declaration and src/core/data.ts (cap first, plain bounded numbers, errors by row and column, units kept); never send, store or log it (no network, storage or code-loading API on the data path), carry it in a link only as the declared canonical token or its digest marker, re-validate every token a link brings, say on the page whenever a copied link carries the data, and never run claims, pacing or labs on it.
status: active
class: blocking
depends_on: [project.viz-component-layer@2, project.no-fake-science@1, project.catalogue-integrity@1]
tags: [data, privacy, share, catalogue]
---

# Rationale

The collection invites a reader to bring their own numbers (ADR 0010). The numbers are theirs.
The site has no server, so the one way they could travel is a link the reader copies. A plate
that parses its own way, keeps a copy, or puts the data in a link without saying so would break
the reader's trust and the gates at once.

# Required behaviour

- A plate takes a reader's data only through its entry's `data` declaration and the shared
  parser, src/core/data.ts. The registry adds the select option `data:<id>`, and the plate reads
  `ctx.data(id)`.
- The byte cap is applied before parsing, and a file over the cap is not read.
- A value is a plain decimal, finite and inside its column's bounds. A refusal names its row and
  column. Every column states its unit, and the page shows it.
- src/core/data.ts and src/core/upload.ts name no network, storage or code-loading API. Nothing
  persists a reader's data.
- A link carries a table only as its canonical base64url token, within `url_bytes`, or else as the
  marker `~<rows>.<digest>`. A token read from a link passes the same parser.
- Whenever a copied link would carry the data, the page says "a copied link carries your data"
  next to the copy action and in the data card.
- A control works on a reader's data at every value, or the declaration lists it in `ignores`:
  the page then disables it and says why, and a test proves it changes nothing on data.
- Claims, pacing and labs run on seeded input only. A plate on a reader's data labels it "Your
  data", and its readouts stay measured.

# Failure behaviour

A plate with its own parser, a data path that names a network or storage API, a link that carries
data the page does not announce, or a declaration whose `replaces` is not a select of the plate is
a blocking finding.

# Verification

- `test/data.test.ts`: parse fuzz, bounds, units, size caps, the SHA-256 digest against
  node:crypto, the link round trip, and the source of the data path.
- `test/registry.test.ts`: every declaration's select exists and gains its option.
- `test/support/budget.ts`: a corner whose select picks `data:<id>` runs on a synthetic table of `rows.max` rows.
- `npm run catalogue -- --check`: the declaration's shape and sense.
- `scripts/audit-ui.mjs`: attaches data in a real browser and finds no request beyond the page's
  origin.
