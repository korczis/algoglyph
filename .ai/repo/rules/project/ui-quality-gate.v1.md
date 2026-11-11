---
id: project.ui-quality-gate
version: 1
kind: rule
title: UI changes pass the browser gate
description: Every change to the page, styles or plates passes the browser gate in a real browser with no finding.
statement: Before merging a change to index.html, src/ or public/, run `npm run verify` and fix until scripts/audit-ui.mjs reports no axe WCAG 2.2 A/AA violation, no console error, no horizontal overflow, every thumbnail rendered and every plate mounted with a readout, in light and dark, at 390 px and 1440 px.
status: active
class: blocking
depends_on: [fleet.ui-uses-flowbite-pro@1, project.viz-component-layer@1]
tags: [ui, accessibility, testing]
---

# Rationale

A canvas collection fails in ways a typecheck cannot see: a plate that throws on mount, a
control without a label, a gallery that overflows a phone, a theme with unreadable text.

# Required behaviour

- `scripts/audit-ui.mjs` is the gate; CI runs it in `validate` and `pages.yml` deploys only
  what passed it.
- A new check is added to the gate, not run by hand once.

# Failure behaviour

A failing gate blocks the merge; it is fixed, never skipped.

# Verification

`node scripts/audit-ui.mjs` exits non-zero on any finding.
