---
schema: feature/v1
id: browser-gate
kind: feature
title: The page is accessible in both themes at phone and desktop width
short_title: Browser gate
headline: Every change is opened in a real browser, in light and dark, at phone and desktop width, before it can ship.
summary: scripts/audit-ui.mjs runs axe WCAG 2.2 A/AA, fails on any console error or horizontal overflow, and proves that every thumbnail renders and every plate mounts with a readout; the shell is Flowbite Pro on Tailwind.
status: stable
weight: 40
domain: gallery
rules: [project.ui-quality-gate, fleet.ui-uses-flowbite-pro, project.verify-commands]
docs: [README.md]
adrs: [adr-0001]
related: [verified-delivery]
tags: [accessibility, wcag, quality-gate, flowbite]
---

## What it does

`npm run verify` runs the typecheck, the unit tests, the README drift check, the build and
the browser gate in the order CI runs them; the same gate runs in front of every merge and
every deployment.

## What it does not do

It judges the rendered page in Chromium; it does not prove the pictures right, which is what
the unit tests and the measured readouts are for.
