# Fixtures of the derived-facts gate

Every file below this directory is scanned as the repository path it has here, by
`node scripts/check-facts.mjs --fixtures` and by `algoglyph facts --fixtures`; the equivalence
test (crates/algoglyph-cli/tests/equivalence.rs) asserts both report the same findings. The
policy excludes this directory from the gate, so the hand-typed counts here are deliberate.

<!-- algoglyph:derived:begin counts -->
40 plates, PL. 042 and #/p/no-such-plate inside a derived region are not judged.
<!-- algoglyph:derived:end counts -->

After the region: 41 plates.
