---
schema: adr/v1
id: adr-0002
kind: adr
title: Public GitHub repository with GitHub Pages
status: proposed
date: 2026-11-11
tags:
  - delivery
provenance:
  origin: authored
---

# 2. Public GitHub repository with GitHub Pages

## Context

algoglyph had no git remote, so CI, Pages and pull requests could not run. The owner was
asked in Claude Code session `c11df473-bd19-4f7f-b5a0-5b2a9396851c` on 2026-11-11 (about
18:05 UTC), via AskUserQuestion, verbatim:

> algoglyph has no git remote yet, so nothing can be delivered (no CI, no Pages, no PRs).
> Where should I create it?
>
> Options: "GitHub public + Pages (Recommended)", "GitHub private", "GitLab private",
> "No remote yet".

Answer, verbatim: "GitHub public + Pages (Recommended)".

## Decision

The repository is public at `github.com/korczis/algoglyph`; the site is deployed by
`.github/workflows/pages.yml` to GitHub Pages from `main`, after the same CI that gates pull
requests. `main` is the trunk; further work lands through pull requests from branches in
`algoglyph-wt/<branch>`.

## Alternatives rejected

- GitHub private: the policy already declares `ui.visibility: public`, and Pages on a
  private repository depends on the account plan.
- GitLab private (as introspect): the CI is written for GitHub Actions.
- No remote: nothing could be delivered.

## Consequences

- The tree is public: the never-publish gate for Flowbite Pro sources applies to every
  change (`licence-check.sh` before each PR); `NOTICE.md` states no Pro file is shipped.
- `MAJORDOMUS_KIT_EVIDENCE_FLOWBITE_PRO` must be set as a repository secret for public CI to
  judge kit use (owner decision of 2026-10-28 for public repos).
