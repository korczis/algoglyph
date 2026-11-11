---
schema: adr/v1
id: adr-0003
kind: adr
title: Pages deploys run on a dedicated lundra runner
status: proposed
date: 2026-11-11
tags:
  - delivery
  - ci
provenance:
  origin: authored
---

# 3. Pages deploys run on a dedicated lundra runner

## Context

GitHub-hosted runners stopped starting jobs for the owner's account on 2026-11-11: algoglyph's
first runs stayed queued for 25+ minutes and prismatic-majordomus validate runs had been queued
since 14:47 UTC, while githubstatus.com reported every component operational. GitHub Pages
with `build_type: workflow` can only deploy through an Actions run. The owner asked to deploy
"asap" (session `c11df473-bd19-4f7f-b5a0-5b2a9396851c`) and was asked via AskUserQuestion,
verbatim:

> GitHub-hosted runners for your account are not starting (algoglyph queued 25+ min;
> prismatic-majordomus validate runs queued since 14:47; githubstatus.com is all green, so it
> looks account-level, e.g. billing/spending limit or concurrency). Pages can only deploy
> through Actions. How do I get algoglyph deployed now?
>
> Options: "Runner on lundra (Recommended)", "Wait for hosted runners", "Runner on this Mac".

Answer, verbatim: "Runner on lundra (Recommended)". The owner then asked (verbatim):
"deploy gh pages, use gh cli, gh itself, add automatded workflow + manual actions / deploy,
validate, verify, continue".

## Decision

- A fourth runner on lundra, `lundra-algoglyph` (label `lundra-algoglyph`, user `ghrunner`,
  install `/home/ghrunner/runner-algoglyph`, `HOME=/home/ghrunner/home-algoglyph`, systemd unit
  `actions.runner.korczis-algoglyph.lundra-algoglyph`), registered to korczis/algoglyph only.
- `pages.yml` (push to main, or by hand) runs every job there: CI through `ci.yml`'s `runner`
  input, then deploy, then `verify.yml`. On lundra the browser gate uses the installed Google
  Chrome and installs nothing system-wide.
- Pull-request CI stays on `ubuntu-latest`, so code from a fork never runs on lundra.
- Manual actions through the gh CLI: `scripts/deploy.sh validate | deploy | verify`
  (`npm run deploy`, `deploy:validate`, `deploy:verify`).

## Alternatives rejected

- Waiting for hosted runners: no known end.
- A temporary runner on the owner's Mac: the Mac's disk is the scarcer resource.

## Consequences

- lundra's capacity is shared with prismatic-majordomus (owner decision 2026-11-01: two heavy
  jobs at most). algoglyph's jobs are Node builds and a headless browser, about 1 GB of disk
  in `home-algoglyph` and `runner-algoglyph/_work`; check `df` there before blaming a failure.
- Removing the runner: `sudo ./svc.sh uninstall` and `./config.sh remove` in its directory.
