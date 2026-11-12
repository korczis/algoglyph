//! The sorting kernels' C ABI, on `wasm32-unknown-unknown` only. No binding generator and no
//! JSON: the caller writes the keys into a buffer the module owns, runs a kernel by index, and
//! reads the result through views onto the module's memory. Every pointer stays valid until
//! the next `ag_sort_input`, `ag_sort_edges`, `ag_sort_run` or `ag_sort_release`.
//!
//! ```text
//!   ag_sort_count() -> u32                       kernels in the registry, sorted by stem
//!   ag_sort_id(k) -> *u8, ag_sort_id_len(k)      the kernel id (atlas slug), UTF-8
//!   ag_sort_meta(k) -> u32                       stable(0 yes,1 no,2 variant) | in_place<<2 | kind<<3
//!   ag_sort_version() -> u32                     crate version, major<<16 | minor<<8 | patch
//!   ag_sort_fingerprint() -> f64                 the sources' FNV-1a, top 53 bits
//!   ag_sort_abi() -> u32                         ABI_VERSION: the layout of everything below
//!   ag_sort_max_n() -> u32, ag_sort_max_edges()  the largest input and arc list accepted
//!   ag_sort_input(n) -> *i32                     room for n keys (tags are the positions);
//!                                                null when n > MAX_N
//!   ag_sort_edges(m) -> *u32                     room for m arcs (u, v) of topological sort;
//!                                                null when m > MAX_EDGES
//!   ag_sort_option_count() -> u32                the tunable options (Options::TUNABLE)
//!   ag_sort_option_name(i) -> *u8, ag_sort_option_name_len(i)   option i's name, UTF-8
//!   ag_sort_reads(k) -> u32                      the options kernel k reads: bit i = option i
//!   ag_sort_options() -> *u32                    option_count words, one per option, read by
//!                                                the next run (0 = the kernel's own default);
//!                                                zero again after ag_sort_release
//!   ag_sort_run(k, n, m, seed_hi, seed_lo, max_steps, trace) -> i32
//!                                                outcome code (0 sorted, 1 truncated,
//!                                                2 not a sort, 3 unsupported), -1 bad call
//!   ag_sort_result() -> *f64                     RESULT_LEN values, see RESULT below
//!   ag_sort_steps() -> *i32                      steps * 3 words (prelude::op)
//!   ag_sort_output() -> *i32, ag_sort_output_tags() -> *u32
//!   ag_sort_strings() -> *u8, ag_sort_string_ends() -> *u32   interned labels, end offsets
//!   ag_sort_note() -> *u8                        the outcome's note (length in RESULT)
//!   ag_sort_release()                            frees the last run
//!   ag_sort_scenario(k) -> f64                   the fixture checksum, top 53 bits
//! ```
use crate::sorting::prelude::*;
use crate::sorting::{
    options_of, run_entry, scenario_checksum, with_option_words, ABI_VERSION, FINGERPRINT,
    MAX_EDGES, MAX_N, REGISTRY, VERSION,
};
use std::cell::RefCell;

/// `ag_sort_result()` layout: cmp, swap, write, read, aux peak, rounds, steps recorded,
/// truncated (0/1), outcome code, output length, auxiliary writes, strings, note length,
/// steps counted (recorded or not).
pub const RESULT_LEN: usize = 14;

#[derive(Default)]
struct State {
    input: Vec<i32>,
    edges: Vec<u32>,
    options: [u32; Options::TUNABLE.len()],
    result: [f64; RESULT_LEN],
    steps: Vec<i32>,
    output: Vec<i32>,
    tags: Vec<u32>,
    strings: Vec<u8>,
    ends: Vec<u32>,
    note: &'static str,
}

thread_local! {
    static STATE: RefCell<State> = RefCell::new(State::default());
}

fn with<R>(f: impl FnOnce(&mut State) -> R) -> R {
    STATE.with(|s| f(&mut s.borrow_mut()))
}

#[no_mangle]
pub extern "C" fn ag_sort_count() -> u32 {
    REGISTRY.len() as u32
}

#[no_mangle]
pub extern "C" fn ag_sort_id(k: u32) -> *const u8 {
    REGISTRY
        .get(k as usize)
        .map_or(core::ptr::null(), |e| e.meta.id.as_ptr())
}

#[no_mangle]
pub extern "C" fn ag_sort_id_len(k: u32) -> u32 {
    REGISTRY
        .get(k as usize)
        .map_or(0, |e| e.meta.id.len() as u32)
}

#[no_mangle]
pub extern "C" fn ag_sort_meta(k: u32) -> u32 {
    REGISTRY.get(k as usize).map_or(u32::MAX, |e| {
        e.meta.stable.code() | (e.meta.in_place as u32) << 2 | e.meta.kind.code() << 3
    })
}

#[no_mangle]
pub extern "C" fn ag_sort_version() -> u32 {
    let mut parts = VERSION.split('.').map(|p| p.parse::<u32>().unwrap_or(0));
    let (a, b, c) = (
        parts.next().unwrap_or(0),
        parts.next().unwrap_or(0),
        parts.next().unwrap_or(0),
    );
    (a & 0xFFFF) << 16 | (b & 0xFF) << 8 | (c & 0xFF)
}

#[no_mangle]
pub extern "C" fn ag_sort_fingerprint() -> f64 {
    (FINGERPRINT >> 11) as f64
}

#[no_mangle]
pub extern "C" fn ag_sort_abi() -> u32 {
    ABI_VERSION
}

#[no_mangle]
pub extern "C" fn ag_sort_max_n() -> u32 {
    MAX_N as u32
}

#[no_mangle]
pub extern "C" fn ag_sort_max_edges() -> u32 {
    MAX_EDGES as u32
}

#[no_mangle]
pub extern "C" fn ag_sort_option_count() -> u32 {
    Options::TUNABLE.len() as u32
}

#[no_mangle]
pub extern "C" fn ag_sort_option_name(i: u32) -> *const u8 {
    Options::TUNABLE
        .get(i as usize)
        .map_or(core::ptr::null(), |s| s.as_ptr())
}

#[no_mangle]
pub extern "C" fn ag_sort_option_name_len(i: u32) -> u32 {
    Options::TUNABLE.get(i as usize).map_or(0, |s| s.len() as u32)
}

/// The options kernel `k` reads, bit i for option i; 0 for a kernel that reads none or no kernel.
#[no_mangle]
pub extern "C" fn ag_sort_reads(k: u32) -> u32 {
    REGISTRY.get(k as usize).map_or(0, |e| {
        let read = options_of(e);
        Options::TUNABLE
            .iter()
            .enumerate()
            .filter(|(_, name)| read.contains(name))
            .fold(0, |m, (i, _)| m | 1 << i)
    })
}

/// The option words the next run reads, one per tunable option.
#[no_mangle]
pub extern "C" fn ag_sort_options() -> *mut u32 {
    with(|s| s.options.as_mut_ptr())
}

/// Room for `n` keys, or null (and no buffer) when `n` exceeds [`MAX_N`]: the caller writes
/// exactly `n` words, so the buffer is never smaller than asked.
#[no_mangle]
pub extern "C" fn ag_sort_input(n: u32) -> *mut i32 {
    with(|s| {
        s.input.clear();
        if n as usize > MAX_N {
            return core::ptr::null_mut();
        }
        s.input.resize(n as usize, 0);
        s.input.as_mut_ptr()
    })
}

/// Room for `m` arcs, or null when `m` exceeds [`MAX_EDGES`].
#[no_mangle]
pub extern "C" fn ag_sort_edges(m: u32) -> *mut u32 {
    with(|s| {
        s.edges.clear();
        if m as usize > MAX_EDGES {
            return core::ptr::null_mut();
        }
        s.edges.resize(2 * m as usize, 0);
        s.edges.as_mut_ptr()
    })
}

#[no_mangle]
pub extern "C" fn ag_sort_run(
    k: u32,
    n: u32,
    m: u32,
    seed_hi: u32,
    seed_lo: u32,
    max_steps: u32,
    trace: u32,
) -> i32 {
    let Some(entry) = REGISTRY.get(k as usize) else {
        return -1;
    };
    with(|s| {
        let n = n as usize;
        let m = m as usize;
        if n > s.input.len() || 2 * m > s.edges.len() {
            return -1;
        }
        let input: Vec<Item> = s.input[..n]
            .iter()
            .enumerate()
            .map(|(i, &key)| Item::new(key, i as u32))
            .collect();
        let opt = with_option_words(
            Options {
                seed: (seed_hi as u64) << 32 | seed_lo as u64,
                edges: s.edges[..2 * m]
                    .chunks_exact(2)
                    .map(|e| (e[0], e[1]))
                    .collect(),
                max_steps,
                trace: trace != 0,
                ..Options::default()
            },
            &s.options,
        );
        let run = run_entry(entry, input, &opt);
        let c = run.counts;
        let (recorded, counted) = (run.tracer.recorded(), run.tracer.step_count());
        let (words, strings) = run.tracer.into_buffers();
        s.strings.clear();
        s.ends.clear();
        for text in &strings {
            s.strings.extend_from_slice(text.as_bytes());
            s.ends.push(s.strings.len() as u32);
        }
        s.note = run.outcome.note().unwrap_or("");
        s.output = run.output.iter().map(|x| x.key).collect();
        s.tags = run.output.iter().map(|x| x.tag).collect();
        s.result = [
            c.cmp as f64,
            c.swap as f64,
            c.write as f64,
            c.read as f64,
            c.aux as f64,
            c.rounds as f64,
            recorded as f64,
            run.truncated as u32 as f64,
            run.outcome.code() as f64,
            s.output.len() as f64,
            c.aux_writes as f64,
            s.ends.len() as f64,
            s.note.len() as f64,
            counted as f64,
        ];
        s.steps = words;
        run.outcome.code() as i32
    })
}

#[no_mangle]
pub extern "C" fn ag_sort_result() -> *const f64 {
    with(|s| s.result.as_ptr())
}

#[no_mangle]
pub extern "C" fn ag_sort_steps() -> *const i32 {
    with(|s| s.steps.as_ptr())
}

#[no_mangle]
pub extern "C" fn ag_sort_output() -> *const i32 {
    with(|s| s.output.as_ptr())
}

#[no_mangle]
pub extern "C" fn ag_sort_output_tags() -> *const u32 {
    with(|s| s.tags.as_ptr())
}

#[no_mangle]
pub extern "C" fn ag_sort_strings() -> *const u8 {
    with(|s| s.strings.as_ptr())
}

#[no_mangle]
pub extern "C" fn ag_sort_string_ends() -> *const u32 {
    with(|s| s.ends.as_ptr())
}

#[no_mangle]
pub extern "C" fn ag_sort_note() -> *const u8 {
    with(|s| s.note.as_ptr())
}

#[no_mangle]
pub extern "C" fn ag_sort_release() {
    with(|s| *s = State::default());
}

#[no_mangle]
pub extern "C" fn ag_sort_scenario(k: u32) -> f64 {
    REGISTRY
        .get(k as usize)
        .map_or(-1.0, |e| (scenario_checksum(e) >> 11) as f64)
}
