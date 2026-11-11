#!/usr/bin/env bash
# The one local gate, in the same order as CI (.github/workflows/ci.yml); stops at the first
# failure. --fast skips the browser gate.
set -euo pipefail
cd "$(dirname "$0")/.."
fast=0
[ "${1:-}" = "--fast" ] && fast=1

step() { printf '\n== %s\n' "$*"; }

step "typecheck"
npx tsc --noEmit

step "unit tests"
npx vitest run

step "build"
npx vite build

flowbite="$HOME/.claude/skills/flowbite-pro/verify.mjs"
if [ -f "$flowbite" ]; then
  step "flowbite pro (owner-level verifier)"
  node "$flowbite" .
else
  step "flowbite pro: verifier not on this machine, skipped (CI runs without it)"
fi

if [ "$fast" = 1 ]; then
  step "browser gate skipped (--fast)"
else
  step "browser gate (axe WCAG 2.2 AA, console, overflow, every plate)"
  node scripts/audit-ui.mjs
fi

if command -v majordomus >/dev/null 2>&1; then
  step "majordomus doctor"
  majordomus doctor
fi

printf '\nverify: ok\n'
