# algoglyph's task entry point (ADR 0005 §6). `just --list` is the documentation: every recipe
# says what it does, and each delegates to the npm script or tool that does it, so the two
# cannot behave differently. test/justfile.test.ts derives the npm scripts from package.json
# and refuses one that no recipe runs.

set positional-arguments := true
set shell := ["bash", "-euo", "pipefail", "-c"]

[doc('List the recipes by group')]
default:
    @just --list

# ---- gates --------------------------------------------------------------------------------

[group('gates')]
[doc("Everything CI runs, in CI's order, browser gate included (npm run verify)")]
verify:
    npm run verify

[group('gates')]
[doc('The gate without the browser: for changes outside src/, index.html and public/')]
verify-fast:
    npm run verify -- --fast

[group('gates')]
[doc('Unit tests, then the main-thread budget and the pacing drive, each alone (builds the wasm first)')]
test:
    npm test

[group('gates')]
[doc('The main-thread budget of every live plate and lab, run alone (config/budgets.yaml)')]
budget:
    npm run test:budget

[group('gates')]
[doc('Every default run of every live plate and lab driven to its end, run alone (config/pacing.yaml)')]
pacing:
    npm run test:pacing

[group('gates')]
[doc('Type-check the site and the tests')]
typecheck:
    npm run typecheck

[group('gates')]
[doc('The browser gate: axe WCAG 2.2 AA, console, overflow, every plate and thumbnail')]
audit *args:
    npm run test:ui -- "$@"

[group('gates')]
[doc('The derived-facts gate: no hand-typed count, plate number or dangling link (--json)')]
facts *args:
    npm run facts -- "$@"

# ---- catalogue ----------------------------------------------------------------------------

[group('catalogue')]
[doc('Validate the catalogue; verbs: --check, stats, list, new <id> (see scripts/catalogue.mjs)')]
catalogue *args:
    npm run catalogue -- "$@"

[group('catalogue')]
[doc('The MC-*/IC-* plan derived from the planned entries; a dry run without --write')]
plan *args:
    npm run catalogue -- plan "$@"

[group('catalogue')]
[doc("Regenerate the README's derived regions (--check refuses stale ones)")]
readme *args:
    npm run readme -- "$@"

# ---- site ---------------------------------------------------------------------------------

[group('site')]
[doc('The dev server (builds the wasm first)')]
dev *args:
    npm run dev -- "$@"

[group('site')]
[doc('The production build into dist/ (builds the wasm first)')]
build:
    npm run build

[group('site')]
[doc('Serve dist/ as production would')]
preview:
    npm run preview

[group('site')]
[doc("Point git at the repository's hooks (.githooks); npm ci does it too")]
hooks:
    npm run prepare

# ---- rust ---------------------------------------------------------------------------------

[group('rust')]
[doc('The Rust kernels: native tests, then the wasm32 module (--build: the module only)')]
wasm *args:
    npm run wasm -- "$@"

[group('rust')]
[doc('The algoglyph CLI (crates/algoglyph-cli); e.g. just cli facts --json')]
cli *args:
    cargo run --quiet -p algoglyph-cli -- "$@"

[group('rust')]
[doc('The derived-facts gate, Rust port with the Rhai checks of tools/checks')]
facts-rs *args:
    cargo run --quiet -p algoglyph-cli -- facts "$@"

[group('rust')]
[doc("Every crate's tests, the CLI's equivalence with the Node gate included")]
test-rs *args:
    cargo test --workspace "$@"

# ---- delivery -----------------------------------------------------------------------------

[group('delivery')]
[doc('Run CI on a ref through gh, default the current branch')]
deploy-validate *args:
    npm run deploy:validate -- "$@"

[group('delivery')]
[confirm('Deploy main to GitHub Pages (validate, deploy, verify)?')]
[doc('Validate, deploy and verify main on GitHub Pages through gh')]
deploy:
    npm run deploy

[group('delivery')]
[doc('Prove production serves a commit (default origin/main) and answers')]
deploy-verify *args:
    npm run deploy:verify -- "$@"
