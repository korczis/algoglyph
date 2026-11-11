//! The plugin prelude, ported from the trideni crate of the Atlas třídicích algoritmů.
//!
//! A plugin is one file `src/sorting/algorithms/<slug_snake>.rs`:
//!
//! ```ignore
//! use crate::sorting::prelude::*;
//!
//! pub const META: Meta = Meta {
//!     id: "quicksort",              // the kernel id = file stem with '_' -> '-'
//!     stable: Stability::No,
//!     in_place: true,
//!     kind: Kind::Comparison,
//! };
//!
//! pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, opt: &Options) -> Outcome { ... }
//! ```
//!
//! The array is mutated only through the [`Tracer`] (`swap`, `set`), so replaying the trace
//! on the input reproduces the output. Auxiliary structures (buckets, heaps, runs, tapes,
//! buffers) are shown with [`Tracer::aux`]; the tracer measures their peak size, which is the
//! `aux` count of a run. Rules for plugin authors:
//!
//! - compare through `cmp` / `cmp_items` / `cmp_at`, write through `swap` / `set`, fetch
//!   values you keep through `read`, so the counters mean what they say;
//! - call `aux(name, items)` whenever an auxiliary structure changes in a way worth seeing,
//!   and `aux(name, &[])` (or `aux_clear`) when it is released;
//! - a terminating algorithm may ignore `ok()`: the tracer stops recording at the step limit
//!   and reports `truncated`, the counts stay exact; an algorithm that may not terminate
//!   (joke sorts) must poll `ok()` and return `Outcome::Truncated`;
//! - parallel and network algorithms call `lane(l)` when they switch lanes and `round()` at
//!   the start of every parallel round (or network layer); without `round()` the round
//!   count is inferred from lanes: a round ends when a lane already used in it is set again.
//!
//! What changed in the port: the trace is recorded as typed words, three `i32` per step
//! ([`STRIDE`]), with auxiliary snapshots in a key pool and labels in an interned string
//! table, which is what the C ABI hands to the browser without any serialisation. The
//! [`Step`] enum survives as the decoded view the tests read ([`Tracer::steps`]).
use std::cell::OnceCell;
use std::collections::HashMap;

pub use core::cmp::Ordering;

/// One element: the key it is sorted by and the tag that proves stability (the original
/// index unless the caller says otherwise).
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Hash)]
pub struct Item {
    pub key: i32,
    pub tag: u32,
}

impl Item {
    pub const fn new(key: i32, tag: u32) -> Self {
        Item { key, tag }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Stability {
    Yes,
    No,
    Variant,
}

impl Stability {
    pub fn as_str(self) -> &'static str {
        match self {
            Stability::Yes => "yes",
            Stability::No => "no",
            Stability::Variant => "variant",
        }
    }

    /// The ABI code: 0 yes, 1 no, 2 variant.
    pub fn code(self) -> u32 {
        match self {
            Stability::Yes => 0,
            Stability::No => 1,
            Stability::Variant => 2,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Kind {
    Comparison,
    Distribution,
    Network,
    External,
    Special,
    Joke,
}

impl Kind {
    pub fn as_str(self) -> &'static str {
        match self {
            Kind::Comparison => "comparison",
            Kind::Distribution => "distribution",
            Kind::Network => "network",
            Kind::External => "external",
            Kind::Special => "special",
            Kind::Joke => "joke",
        }
    }

    /// The ABI code, in declaration order.
    pub fn code(self) -> u32 {
        match self {
            Kind::Comparison => 0,
            Kind::Distribution => 1,
            Kind::Network => 2,
            Kind::External => 3,
            Kind::Special => 4,
            Kind::Joke => 5,
        }
    }
}

/// What a plugin declares about itself; the test suite checks it against behaviour.
#[derive(Clone, Copy, Debug)]
pub struct Meta {
    pub id: &'static str,
    pub stable: Stability,
    pub in_place: bool,
    pub kind: Kind,
}

/// How a run ended.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Outcome {
    /// `v` holds the input sorted.
    Sorted,
    /// The step limit stopped the algorithm before it finished (`ok()` was false).
    Truncated,
    /// The algorithm does not produce a sorted permutation by design (Stalin Sort drops
    /// items, Miracle Sort waits); the reason is reported.
    NotASort(&'static str),
    /// The input is outside the algorithm's domain (for example a key range too wide for
    /// counting sort); the reason is reported and `v` is left unchanged.
    Unsupported(&'static str),
}

impl Outcome {
    pub fn as_str(self) -> &'static str {
        match self {
            Outcome::Sorted => "sorted",
            Outcome::Truncated => "truncated",
            Outcome::NotASort(_) => "not-a-sort",
            Outcome::Unsupported(_) => "unsupported",
        }
    }

    /// The ABI code: 0 sorted, 1 truncated, 2 not a sort, 3 unsupported.
    pub fn code(self) -> u32 {
        match self {
            Outcome::Sorted => 0,
            Outcome::Truncated => 1,
            Outcome::NotASort(_) => 2,
            Outcome::Unsupported(_) => 3,
        }
    }

    pub fn note(self) -> Option<&'static str> {
        match self {
            Outcome::NotASort(s) | Outcome::Unsupported(s) => Some(s),
            _ => None,
        }
    }
}

pub type SortFn = fn(&mut Tracer, &mut Vec<Item>, &Options) -> Outcome;

/// One registered plugin (generated by `build.rs`).
pub struct Entry {
    pub stem: &'static str,
    pub meta: &'static Meta,
    pub sort: SortFn,
}

/// Default step limit when the trace is recorded.
pub const DEFAULT_MAX_STEPS_TRACE: u32 = 200_000;
/// Default step limit in count-only mode (`trace = false`).
pub const DEFAULT_MAX_STEPS_COUNT: u32 = 50_000_000;
/// The recorded trace holds at most this many keys of `aux` snapshots in total.
pub const AUX_KEY_BUDGET: u64 = 2_000_000;

/// Request options. Every field has a default; `0` in `base`, `k` and `max_steps` means
/// "the algorithm's (or engine's) own default".
#[derive(Clone, Debug)]
pub struct Options {
    /// Seed of the deterministic generator returned by `Tracer::rng`.
    pub seed: u64,
    /// Radix / digit base for distribution sorts (0 = the algorithm's default).
    pub base: u32,
    /// A size parameter: k of k-way merges, d of d-ary heaps, buckets, … (0 = default).
    pub k: u32,
    /// Edges of a DAG for topological sort, as pairs of input indices.
    pub edges: Vec<(u32, u32)>,
    /// Step limit (0 = 200 000 with a trace, 50 000 000 count-only).
    pub max_steps: u32,
    /// `false` = count-only mode: the run has `output` and `counts`, no steps.
    pub trace: bool,
}

impl Default for Options {
    fn default() -> Self {
        Options {
            seed: 0x5EED_1234,
            base: 0,
            k: 0,
            edges: Vec::new(),
            max_steps: 0,
            trace: true,
        }
    }
}

impl Options {
    /// The step limit this run uses.
    pub fn step_limit(&self) -> u64 {
        if self.max_steps > 0 {
            self.max_steps as u64
        } else if self.trace {
            DEFAULT_MAX_STEPS_TRACE as u64
        } else {
            DEFAULT_MAX_STEPS_COUNT as u64
        }
    }
}

/// SplitMix64 (Steele, Lea & Flood 2014): small, fast, deterministic.
#[derive(Clone, Debug)]
pub struct SplitMix64 {
    state: u64,
}

impl SplitMix64 {
    pub fn new(seed: u64) -> Self {
        SplitMix64 { state: seed }
    }

    pub fn next_u64(&mut self) -> u64 {
        self.state = self.state.wrapping_add(0x9E37_79B9_7F4A_7C15);
        let mut z = self.state;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        z ^ (z >> 31)
    }

    /// Uniform in `0..n` (0 when `n == 0`).
    pub fn below(&mut self, n: u64) -> u64 {
        if n == 0 {
            return 0;
        }
        ((self.next_u64() as u128 * n as u128) >> 64) as u64
    }

    /// Uniform index in `lo..hi` (`lo` when the range is empty).
    pub fn range(&mut self, lo: usize, hi: usize) -> usize {
        if hi <= lo {
            return lo;
        }
        lo + self.below((hi - lo) as u64) as usize
    }

    /// Uniform in `[0, 1)`.
    pub fn next_f64(&mut self) -> f64 {
        (self.next_u64() >> 11) as f64 / (1u64 << 53) as f64
    }
}

/// Operation counters of a run.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Counts {
    pub cmp: u64,
    pub swap: u64,
    pub write: u64,
    pub read: u64,
    /// Peak number of items held in auxiliary structures at the same time.
    pub aux: u64,
    /// Parallel rounds / network depth; 0 for a sequential algorithm.
    pub rounds: u64,
}

/// Words per recorded step.
pub const STRIDE: usize = 3;

/// Step op codes: the low four bits of a step's first word (see [`Tracer::words`]).
pub mod op {
    /// `v[i]` vs `v[j]`: w0 = op | (r+1)<<4 | i<<8, w1 = j.
    pub const CMP: i32 = 0;
    /// Two held keys: w0 = op | (r+1)<<4 | (at+1)<<8 (0 = no position), w1 = a, w2 = b.
    pub const CMPV: i32 = 1;
    /// w0 = op | i<<8, w1 = j.
    pub const SWAP: i32 = 2;
    /// w0 = op | i<<8, w1 = key, w2 = tag (bit pattern of the u32).
    pub const SET: i32 = 3;
    /// w0 = op | i<<8.
    pub const READ: i32 = 4;
    /// Range `[from, to)`: w0 = op | from<<8, w1 = to, w2 = label string id.
    pub const MARK: i32 = 5;
    /// Snapshot: w0 = op | name string id<<8, w1 = pool offset, w2 = number of keys.
    pub const AUX: i32 = 6;
    /// w0 = op | text string id<<8.
    pub const PHASE: i32 = 7;
    /// w1 = lane.
    pub const LANE: i32 = 8;
    /// w1 = round number (1-based).
    pub const ROUND: i32 = 9;
}

/// One recorded operation, decoded. Indices are array positions.
#[derive(Clone, Debug, PartialEq)]
pub enum Step {
    /// `v[i]` compared with `v[j]`; `r` = -1 / 0 / 1.
    Cmp {
        i: u32,
        j: u32,
        r: i8,
    },
    /// Two held values compared (`at` = the array position of `b`, when there is one).
    Cmpv {
        a: i32,
        b: i32,
        r: i8,
        at: Option<u32>,
    },
    Swap {
        i: u32,
        j: u32,
    },
    Set {
        i: u32,
        key: i32,
        tag: u32,
    },
    Read {
        i: u32,
    },
    /// A highlighted range `[from, to)`: a run, a partition, a bucket.
    Mark {
        from: u32,
        to: u32,
        label: String,
    },
    /// Snapshot of an auxiliary structure (its keys, in its own order).
    Aux {
        name: String,
        keys: Vec<i32>,
    },
    Phase {
        text: String,
    },
    Lane {
        lane: u32,
    },
    /// Start of parallel round `n` (1-based).
    Round {
        n: u64,
    },
}

fn ord_bits(o: Ordering) -> i32 {
    match o {
        Ordering::Less => 0,
        Ordering::Equal => 1,
        Ordering::Greater => 2,
    }
}

/// Records the operations of one run and counts them.
pub struct Tracer {
    recording: bool,
    max_steps: u64,
    words: Vec<i32>,
    pool: Vec<i32>,
    strings: Vec<String>,
    string_ids: HashMap<String, u32>,
    decoded: OnceCell<Vec<Step>>,
    n_steps: u64,
    aux_keys: u64,
    truncated: bool,
    counts: Counts,
    rng: SplitMix64,
    lane: u32,
    lanes_in_round: Vec<u64>,
    lanes_used: bool,
    inferred_rounds: u64,
    explicit_rounds: u64,
    aux_sizes: Vec<(String, usize)>,
    aux_now: usize,
    aux_peak: usize,
}

impl Tracer {
    pub fn new(opt: &Options) -> Self {
        Tracer {
            recording: opt.trace,
            max_steps: opt.step_limit(),
            words: Vec::new(),
            pool: Vec::new(),
            strings: Vec::new(),
            string_ids: HashMap::new(),
            decoded: OnceCell::new(),
            n_steps: 0,
            aux_keys: 0,
            truncated: false,
            counts: Counts::default(),
            rng: SplitMix64::new(opt.seed),
            lane: 0,
            lanes_in_round: Vec::new(),
            lanes_used: false,
            inferred_rounds: 0,
            explicit_rounds: 0,
            aux_sizes: Vec::new(),
            aux_now: 0,
            aux_peak: 0,
        }
    }

    /// Counts one step; true when it is to be recorded.
    #[inline]
    fn tick(&mut self, aux_len: usize) -> bool {
        self.n_steps += 1;
        self.aux_keys += aux_len as u64;
        if self.n_steps > self.max_steps || self.aux_keys > AUX_KEY_BUDGET {
            self.truncated = true;
            return false;
        }
        self.recording && !self.truncated
    }

    #[inline]
    fn push(&mut self, op: i32, p: u32, w1: i32, w2: i32) {
        self.words.push(op | ((p as i32) << 8));
        self.words.push(w1);
        self.words.push(w2);
    }

    fn intern(&mut self, s: &str) -> u32 {
        if let Some(&id) = self.string_ids.get(s) {
            return id;
        }
        let id = self.strings.len() as u32;
        self.strings.push(s.to_string());
        self.string_ids.insert(s.to_string(), id);
        id
    }

    /// Compares `v[i].key` with `v[j].key`.
    #[inline]
    pub fn cmp(&mut self, v: &[Item], i: usize, j: usize) -> Ordering {
        let r = v[i].key.cmp(&v[j].key);
        self.counts.cmp += 1;
        if self.tick(0) {
            self.push(op::CMP | (ord_bits(r) << 4), i as u32, j as i32, 0);
        }
        r
    }

    /// `v[i] < v[j]`.
    #[inline]
    pub fn less(&mut self, v: &[Item], i: usize, j: usize) -> bool {
        self.cmp(v, i, j) == Ordering::Less
    }

    /// Compares two held items.
    #[inline]
    pub fn cmp_items(&mut self, a: &Item, b: &Item) -> Ordering {
        let r = a.key.cmp(&b.key);
        self.counts.cmp += 1;
        if self.tick(0) {
            self.push(op::CMPV | (ord_bits(r) << 4), 0, a.key, b.key);
        }
        r
    }

    /// Compares a held item `x` with `v[j]` (the trace highlights position `j`).
    #[inline]
    pub fn cmp_at(&mut self, x: &Item, v: &[Item], j: usize) -> Ordering {
        let r = x.key.cmp(&v[j].key);
        self.counts.cmp += 1;
        if self.tick(0) {
            self.push(op::CMPV | (ord_bits(r) << 4), j as u32 + 1, x.key, v[j].key);
        }
        r
    }

    #[inline]
    pub fn swap(&mut self, v: &mut [Item], i: usize, j: usize) {
        v.swap(i, j);
        self.counts.swap += 1;
        if self.tick(0) {
            self.push(op::SWAP, i as u32, j as i32, 0);
        }
    }

    #[inline]
    pub fn set(&mut self, v: &mut [Item], i: usize, item: Item) {
        v[i] = item;
        self.counts.write += 1;
        if self.tick(0) {
            self.push(op::SET, i as u32, item.key, item.tag as i32);
        }
    }

    #[inline]
    pub fn read(&mut self, v: &[Item], i: usize) -> Item {
        self.counts.read += 1;
        if self.tick(0) {
            self.push(op::READ, i as u32, 0, 0);
        }
        v[i]
    }

    /// Highlights the range `[from, to)` with a label (run, partition, bucket, …).
    pub fn mark(&mut self, from: usize, to: usize, label: &str) {
        if self.tick(0) {
            let id = self.intern(label) as i32;
            self.push(op::MARK, from as u32, to as i32, id);
        }
    }

    /// Snapshot of the auxiliary structure `name`; its current size counts towards the
    /// `aux` peak until it is replaced or cleared with an empty slice.
    pub fn aux(&mut self, name: &str, items: &[Item]) {
        let len = items.len();
        match self.aux_sizes.iter_mut().find(|(n, _)| n == name) {
            Some(entry) => {
                self.aux_now = self.aux_now - entry.1 + len;
                entry.1 = len;
            }
            None => {
                if len > 0 {
                    self.aux_sizes.push((name.to_string(), len));
                    self.aux_now += len;
                }
            }
        }
        if len == 0 {
            self.aux_sizes.retain(|(n, s)| !(n == name && *s == 0));
        }
        if self.aux_now > self.aux_peak {
            self.aux_peak = self.aux_now;
        }
        if self.tick(len) {
            let id = self.intern(name);
            let at = self.pool.len() as i32;
            self.pool.extend(items.iter().map(|x| x.key));
            self.push(op::AUX, id, at, len as i32);
        }
    }

    /// Releases the auxiliary structure `name`.
    pub fn aux_clear(&mut self, name: &str) {
        self.aux(name, &[]);
    }

    pub fn phase(&mut self, text: &str) {
        if self.tick(0) {
            let id = self.intern(text);
            self.push(op::PHASE, id, 0, 0);
        }
    }

    /// Sets the current parallel lane.
    pub fn lane(&mut self, lane: u32) {
        let word = (lane / 64) as usize;
        let bit = 1u64 << (lane % 64);
        if self.lanes_in_round.len() <= word {
            self.lanes_in_round.resize(word + 1, 0);
        }
        if !self.lanes_used {
            self.lanes_used = true;
            self.inferred_rounds = 1;
        } else if self.lanes_in_round[word] & bit != 0 {
            self.inferred_rounds += 1;
            self.lanes_in_round.iter_mut().for_each(|w| *w = 0);
        }
        self.lanes_in_round[word] |= bit;
        self.lane = lane;
        if self.tick(0) {
            self.push(op::LANE, 0, lane as i32, 0);
        }
    }

    /// The current parallel lane.
    pub fn current_lane(&self) -> u32 {
        self.lane
    }

    /// Starts a new parallel round (network layer).
    pub fn round(&mut self) {
        self.explicit_rounds += 1;
        let n = self.explicit_rounds;
        if self.tick(0) {
            self.push(op::ROUND, 0, n as i32, 0);
        }
    }

    /// False once the step limit is exceeded: a non-terminating algorithm must stop and
    /// return `Outcome::Truncated`.
    #[inline]
    pub fn ok(&self) -> bool {
        self.n_steps <= self.max_steps
    }

    /// Deterministic generator seeded from `options.seed`.
    pub fn rng(&mut self) -> &mut SplitMix64 {
        &mut self.rng
    }

    /// True when steps are being recorded (trace mode and below the limits). Use it only to
    /// skip building a snapshot that would not be recorded; never let it change behaviour.
    pub fn tracing(&self) -> bool {
        self.recording && !self.truncated
    }

    /// True once the recorded trace is incomplete.
    pub fn truncated(&self) -> bool {
        self.truncated
    }

    /// Steps counted so far (recorded or not).
    pub fn step_count(&self) -> u64 {
        self.n_steps
    }

    pub fn counts(&self) -> Counts {
        let mut c = self.counts;
        c.aux = self.aux_peak as u64;
        c.rounds = if self.explicit_rounds > 0 {
            self.explicit_rounds
        } else {
            self.inferred_rounds
        };
        c
    }

    /// The recorded steps as typed words, [`STRIDE`] per step (codes in [`op`]).
    pub fn words(&self) -> &[i32] {
        &self.words
    }

    /// The keys of every `aux` snapshot, back to back.
    pub fn pool(&self) -> &[i32] {
        &self.pool
    }

    /// The interned labels, names and phase texts, by id.
    pub fn strings(&self) -> &[String] {
        &self.strings
    }

    /// Number of recorded steps.
    pub fn recorded(&self) -> usize {
        self.words.len() / STRIDE
    }

    /// The recorded steps, decoded (built once, on first use).
    pub fn steps(&self) -> &[Step] {
        self.decoded
            .get_or_init(|| decode(&self.words, &self.pool, &self.strings))
    }

    /// The recorded words, pool and strings, moved out (the C ABI keeps them for the caller).
    pub fn into_buffers(self) -> (Vec<i32>, Vec<i32>, Vec<String>) {
        (self.words, self.pool, self.strings)
    }

    pub fn into_steps(self) -> Vec<Step> {
        let words = self.words;
        decode(&words, &self.pool, &self.strings)
    }
}

/// Decodes typed words back into [`Step`]s: the inverse of the recording, used by the tests.
pub fn decode(words: &[i32], pool: &[i32], strings: &[String]) -> Vec<Step> {
    let r = |w: i32| (((w >> 4) & 3) - 1) as i8;
    let s = |id: u32| strings.get(id as usize).cloned().unwrap_or_default();
    words
        .chunks_exact(STRIDE)
        .map(|w| {
            let p = (w[0] as u32) >> 8;
            match w[0] & 15 {
                op::CMP => Step::Cmp {
                    i: p,
                    j: w[1] as u32,
                    r: r(w[0]),
                },
                op::CMPV => Step::Cmpv {
                    a: w[1],
                    b: w[2],
                    r: r(w[0]),
                    at: p.checked_sub(1),
                },
                op::SWAP => Step::Swap {
                    i: p,
                    j: w[1] as u32,
                },
                op::SET => Step::Set {
                    i: p,
                    key: w[1],
                    tag: w[2] as u32,
                },
                op::READ => Step::Read { i: p },
                op::MARK => Step::Mark {
                    from: p,
                    to: w[1] as u32,
                    label: s(w[2] as u32),
                },
                op::AUX => {
                    let at = w[1] as usize;
                    Step::Aux {
                        name: s(p),
                        keys: pool[at..at + w[2] as usize].to_vec(),
                    }
                }
                op::PHASE => Step::Phase { text: s(p) },
                op::LANE => Step::Lane { lane: w[1] as u32 },
                _ => Step::Round {
                    n: w[1] as u32 as u64,
                },
            }
        })
        .collect()
}
