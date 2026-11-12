#!/usr/bin/env bash
# Builds the Rust kernels (crates/algoglyph-kernels) for the browser, the majordomus-core way:
# native tests first, then the wasm32 cdylib, copied to src/wasm/ where Vite imports it, with
# its SHA-256 beside it. Both are build outputs and never committed (ADR 0004 §6).
#
#   scripts/wasm.sh            native tests + wasm build
#   scripts/wasm.sh --build    wasm build only (what dev, build and test run first)
set -euo pipefail
cd "$(dirname "$0")/.."
CRATE=crates/algoglyph-kernels
OUT=src/wasm/algoglyph_kernels.wasm
export CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-$PWD/$CRATE/target}"
command -v cargo >/dev/null || { echo "wasm.sh: cargo is not installed (rustup.rs)" >&2; exit 2; }
if ! rustup target list --installed 2>/dev/null | grep -qx wasm32-unknown-unknown; then
  echo "wasm.sh: adding the wasm32-unknown-unknown target" >&2
  rustup target add wasm32-unknown-unknown
fi
if [ "${1:-}" != "--build" ]; then
  cargo test --manifest-path "$CRATE/Cargo.toml" --release --quiet
fi
cargo rustc --manifest-path "$CRATE/Cargo.toml" --release --quiet \
  --target wasm32-unknown-unknown --crate-type cdylib
mkdir -p "$(dirname "$OUT")"
cp "$CARGO_TARGET_DIR/wasm32-unknown-unknown/release/algoglyph_kernels.wasm" "$OUT"
# the module's content hash, which keys the browser's trace cache (src/kernels/sorting-wasm)
if command -v sha256sum >/dev/null; then sha256sum "$OUT"; else shasum -a 256 "$OUT"; fi \
  | cut -d' ' -f1 > "$OUT.sha256"
echo "wasm.sh: $OUT ($(wc -c < "$OUT" | tr -d ' ') bytes)"
