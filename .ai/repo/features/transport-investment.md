---
schema: feature/v1
id: transport-investment
kind: feature
title: Which transport to build, decided by return on investment
short_title: Transport investment
headline: Send places, demands, modes and hubs; get every route ranked by ROI, the portfolio within budget, and why each mode won.
summary: src/plates/transport-investment/invest.ts enumerates each demand's routes on a multimodal graph with the yen-k-shortest kernel on the graph engine, prices each as OpenTTD pays (income on the source-to-sink distance and total transit, the game's time factor including its asymptotic tail; each leg its own costs), keeps the best route by ROI and picks the budgeted portfolio with the knapsack-dp kernel on the grid engine; data.ts echoes the effective inputs.
status: stable
weight: 50
domain: backend
rules: [project.no-fake-science, project.typed-flow]
docs: [docs/ARCHITECTURE.md]
related: [flow-command-line, track-planning, action-plan]
tags: [planning, roi, multimodal, openttd]
---

## What it does

Answers, for each demand, which way of carrying it pays best — direct by any mode or through a
hub with a change of mode — and which of those to build within a budget.

## What it does not do

It does not lay track (track-planning does), nor act in a game; station catchment, ratings and
competition are not modelled.
