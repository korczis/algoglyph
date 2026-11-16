---
schema: feature/v1
id: action-plan
kind: feature
title: A plan shown as a DAG and checked press by press before anything runs
short_title: Action plan
headline: Send the actions a plan needs and what each waits for; get the steps in order with the cash and loan after each, or the press that would break it.
summary: src/plates/action-plan/plan.ts orders the actions with the collection's Kahn's waves kernel on the graph engine, expands each into presses (repay 50k as five presses of the loan step), walks cash and loan through every press as the game does, and refuses an overdraft, a repayment of a repaid loan or a loan past its limit; data.ts serves it to the flow CLI with the DAG ready to draw.
status: stable
weight: 40
domain: backend
rules: [project.no-fake-science, project.typed-flow]
docs: [docs/ARCHITECTURE.md]
related: [flow-command-line, track-planning]
tags: [planning, dag, openttd, cash-flow]
---

## What it does

Turns a list of actions with dependencies into the exact sequence an executor presses, with the
balance after each step and the waves to draw, so the owner sees the plan before it runs.

## What it does not do

It never acts: the executor (the OpenTTD fork's player or bot) presses the steps.
