//! The sorting kernels, ported from the sorting atlas's engine crate (trideni).
//!
//! Every algorithm is a plugin file in `algorithms/`; `build.rs` (this directory) discovers
//! them and generates [`REGISTRY`]. A run records its operations through
//! [`prelude::Tracer`] as typed words, which the wasm build hands to the browser through the
//! plain C ABI in `abi.rs` (no JSON, no binding generator); the browser's adapter
//! (`src/kernels/sorting-wasm/`) decodes them into the array engine's `ArrayOps` trace.
//! The kernel id is the atlas slug (`META.id`, the file stem with `_` -> `-`).
pub mod kit;
pub mod prelude;

mod registry {
    include!(concat!(env!("OUT_DIR"), "/sorting_registry.rs"));
}

pub use registry::{algorithms, FINGERPRINT, REGISTRY};

use prelude::*;

/// The crate version, which keys the browser's trace cache together with [`FINGERPRINT`].
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// Largest accepted input; the C ABI exports it (`ag_sort_max_n`) so no caller restates it.
pub const MAX_N: usize = 1 << 20;
/// Largest accepted arc list of topological sort (`ag_sort_max_edges`).
pub const MAX_EDGES: usize = 4 * MAX_N;
/// The layout of the C ABI (`ag_sort_abi`): op codes, the result array, the exports. A
/// browser cache keys traces by it.
pub const ABI_VERSION: u32 = 2;

pub fn find(id: &str) -> Option<&'static Entry> {
    REGISTRY.iter().find(|e| e.meta.id == id)
}

/// The result of one run; the recorded steps stay in the tracer, as typed words.
pub struct Run {
    pub output: Vec<Item>,
    pub tracer: Tracer,
    pub counts: Counts,
    pub truncated: bool,
    pub outcome: Outcome,
}

/// Runs one entry on `input`.
pub fn run_entry(entry: &Entry, input: Vec<Item>, opt: &Options) -> Run {
    let mut t = Tracer::new(opt);
    let mut v = input;
    let outcome = (entry.sort)(&mut t, &mut v, opt);
    let counts = t.counts();
    let truncated = t.truncated() || outcome == Outcome::Truncated;
    Run {
        output: v,
        tracer: t,
        counts,
        truncated,
        outcome,
    }
}

/// Runs the algorithm `id` on `input`.
pub fn run(id: &str, input: Vec<Item>, opt: &Options) -> Result<Run, String> {
    let entry = find(id).ok_or_else(|| format!("unknown algorithm: {id}"))?;
    if input.len() > MAX_N {
        return Err(format!(
            "input too large: {} items (limit {MAX_N})",
            input.len()
        ));
    }
    Ok(run_entry(entry, input, opt))
}

/// The kernel manifest (`src/sorting/kernels.json`, checked in): every kernel id with its
/// declared stability, in-place flag and kind, as the registry holds them. The catalogue gate
/// reads it to refuse a sidecar record that names no kernel; the native tests refuse a stale
/// copy.
pub fn manifest() -> String {
    let rows: Vec<String> = REGISTRY
        .iter()
        .map(|e| {
            format!(
                "    {{ \"id\": \"{}\", \"stable\": \"{}\", \"in_place\": {}, \"kind\": \"{}\" }}",
                e.meta.id,
                e.meta.stable.as_str(),
                e.meta.in_place,
                e.meta.kind.as_str()
            )
        })
        .collect();
    format!(
        "{{\n  \"schema\": \"algoglyph-kernels/v1\",\n  \"version\": \"{VERSION}\",\n  \"abi\": {ABI_VERSION},\n  \"max_n\": {MAX_N},\n  \"kernels\": [\n{}\n  ]\n}}\n",
        rows.join(",\n")
    )
}

/// FNV-1a 64 over a stream of 32-bit words.
pub struct Fnv(pub u64);

impl Fnv {
    pub fn new() -> Self {
        Fnv(0xCBF2_9CE4_8422_2325)
    }

    pub fn word(&mut self, w: u32) {
        for b in w.to_le_bytes() {
            self.0 ^= b as u64;
            self.0 = self.0.wrapping_mul(0x0000_0100_0000_01B3);
        }
    }

    pub fn wide(&mut self, w: u64) {
        self.word(w as u32);
        self.word((w >> 32) as u32);
    }
}

impl Default for Fnv {
    fn default() -> Self {
        Self::new()
    }
}

/// The inputs of the shared scenario: random keys with duplicates, and a reversed run.
pub fn scenario_inputs() -> Vec<Vec<Item>> {
    let mut r = SplitMix64::new(0xA160_6170);
    let random: Vec<Item> = (0..48).map(|i| Item::new(r.below(32) as i32, i)).collect();
    let reversed: Vec<Item> = (0..33u32).map(|i| Item::new(100 - i as i32, i)).collect();
    vec![random, reversed]
}

/// The scenario the native tests and the wasm equivalence test both run
/// (`src/sorting/fixture.json`): a hash of everything a run hands to the browser — outcome,
/// counts, output, and every recorded word and string.
pub fn scenario_checksum(entry: &Entry) -> u64 {
    let mut h = Fnv::new();
    for input in scenario_inputs() {
        let opt = Options {
            seed: 7,
            max_steps: 1_000_000,
            ..Options::default()
        };
        let run = run_entry(entry, input, &opt);
        h.word(run.outcome.code());
        h.word(run.truncated as u32);
        let c = run.counts;
        for x in [
            c.cmp,
            c.swap,
            c.write,
            c.read,
            c.aux,
            c.aux_writes,
            c.rounds,
        ] {
            h.wide(x);
        }
        h.word(run.output.len() as u32);
        for x in &run.output {
            h.word(x.key as u32);
            h.word(x.tag);
        }
        for &w in run.tracer.words() {
            h.word(w as u32);
        }
        for s in run.tracer.strings() {
            h.word(s.len() as u32);
            for b in s.bytes() {
                h.word(b as u32);
            }
        }
    }
    h.0
}

#[cfg(test)]
mod tests;
