---
schema: feature/v1
id: human-pointing
kind: feature
title: A pointer moved the way a hand moves it, seeded the same as the fork's player
short_title: Human pointing
headline: Ask for a move from one point to a target and get the samples a person's hand would make, Fitts' law and all.
summary: src/plates/human-pointing/motion.ts is the OpenTTD fork's motion.rs ported operation for operation (xorshift64* in BigInt, Rust's rounding); its data form answers {from, to, width, seed, model?, drag?} with samples [x, y, wait_ms]; test/human-pointing.test.ts holds it to motion.rs's golden vectors bit for bit.
status: stable
weight: 30
domain: backend
rules: [project.no-fake-science]
docs: [docs/ARCHITECTURE.md]
related: [flow-command-line]
tags: [human-motion, fitts, minimum-jerk, openttd]
---

## What it does

Gives one movement's samples, its total time, and the model it used; the same seed moves the
same way here and in the fork's built-in fallback.

## What it does not do

It moves no pointer itself; the caller replays the samples.
