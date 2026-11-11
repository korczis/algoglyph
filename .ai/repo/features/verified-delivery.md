---
schema: feature/v1
id: verified-delivery
kind: feature
title: Production is proved to serve the commit that was pushed
short_title: Verified delivery
headline: A push to main is validated, deployed to GitHub Pages and then checked against what the live site actually serves.
summary: pages.yml runs the CI gate, deploys the validated dist with actions/deploy-pages and runs verify.yml, which requires revision.txt on the live site to equal the pushed commit; the jobs run on the dedicated lundra-algoglyph runner.
status: stable
weight: 50
domain: gallery
adrs: [adr-0002, adr-0003]
docs: [README.md]
related: [browser-gate]
tags: [deployment, github-pages, ci]
---

## What it does

Each stage runs only if the previous one passed: CI, deploy, verify production. By hand,
`scripts/deploy.sh deploy` runs the same workflow and `scripts/deploy.sh verify [sha]`
checks production at any time.

## What it does not do

It states no status of the live site: the plan's I003 and I004 hold the evidence of the first
verified deployment, and `scripts/deploy.sh verify` answers for any later one.
