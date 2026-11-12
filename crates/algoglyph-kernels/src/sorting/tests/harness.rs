//! Input generators and checks shared by the conformance tests (ported from trideni).
use crate::sorting as engine;
use crate::sorting::kit;
use crate::sorting::prelude::*;
use crate::sorting::REGISTRY;

pub fn random_cases() -> usize {
    std::env::var("TRIDENI_RANDOM_CASES")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(10_000)
}

fn only() -> Option<Vec<String>> {
    std::env::var("TRIDENI_ONLY")
        .ok()
        .map(|s| s.split(',').map(|x| x.trim().to_string()).collect())
}

/// Runs `check` on every registered entry (in parallel) and returns the failures.
pub fn for_each_entry<F>(check: F) -> Vec<String>
where
    F: Fn(&Entry) -> Result<(), String> + Sync,
{
    let filter = only();
    let entries: Vec<&Entry> = REGISTRY
        .iter()
        .filter(|e| {
            filter
                .as_ref()
                .map_or(true, |f| f.iter().any(|x| x == e.meta.id))
        })
        .collect();
    let threads = std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(4)
        .min(16);
    let next = std::sync::atomic::AtomicUsize::new(0);
    let failures = std::sync::Mutex::new(Vec::new());
    std::thread::scope(|s| {
        for _ in 0..threads {
            s.spawn(|| loop {
                let i = next.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                if i >= entries.len() {
                    break;
                }
                let e = entries[i];
                let r = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| check(e)));
                let msg = match r {
                    Ok(Ok(())) => None,
                    Ok(Err(m)) => Some(m),
                    Err(p) => Some(
                        p.downcast_ref::<String>()
                            .cloned()
                            .or_else(|| p.downcast_ref::<&str>().map(|s| s.to_string()))
                            .unwrap_or_else(|| "panic".to_string()),
                    ),
                };
                if let Some(m) = msg {
                    failures
                        .lock()
                        .unwrap()
                        .push(format!("  {}: {}", e.meta.id, m));
                }
            });
        }
    });
    let mut f = failures.into_inner().unwrap();
    f.sort();
    f
}

pub fn random_input(n: usize, lo: i32, hi: i32, seed: u64) -> Vec<Item> {
    let mut r = SplitMix64::new(seed);
    let span = (hi as i64 - lo as i64 + 1) as u64;
    (0..n)
        .map(|i| Item::new((lo as i64 + r.below(span) as i64) as i32, i as u32))
        .collect()
}

fn from_keys(keys: impl IntoIterator<Item = i32>) -> Vec<Item> {
    keys.into_iter()
        .enumerate()
        .map(|(i, k)| Item::new(k, i as u32))
        .collect()
}

/// The adversarial presets of `data/site.toml` and a few more shapes.
pub fn presets(n: usize, seed: u64) -> Vec<(&'static str, Vec<Item>)> {
    let ni = n as i32;
    let mut r = SplitMix64::new(seed);
    vec![
        ("random", random_input(n, 0, ni.max(1) * 2, seed)),
        ("sorted", from_keys(0..ni)),
        ("reversed", from_keys((0..ni).rev())),
        ("all-equal", from_keys((0..ni).map(|_| 7))),
        ("few-unique", from_keys((0..ni).map(|_| r.below(4) as i32))),
        ("organ-pipe", from_keys((0..ni).map(|i| i.min(ni - 1 - i)))),
        ("sawtooth", from_keys((0..ni).map(|i| i % 9))),
        ("nearly-sorted", {
            let mut k: Vec<i32> = (0..ni).collect();
            for _ in 0..(n / 20).max(1) {
                if n > 1 {
                    let a = r.below(n as u64) as usize;
                    let b = r.below(n as u64) as usize;
                    k.swap(a, b);
                }
            }
            from_keys(k)
        }),
        ("negative", random_input(n, -1000, 1000, seed ^ 0xABCD)),
        (
            "extremes",
            from_keys((0..ni).map(|i| match i % 4 {
                0 => i32::MAX,
                1 => i32::MIN,
                2 => 0,
                _ => i * 1000,
            })),
        ),
    ]
}

fn key_span(input: &[Item]) -> i64 {
    let lo = input.iter().map(|x| x.key as i64).min().unwrap_or(0);
    let hi = input.iter().map(|x| x.key as i64).max().unwrap_or(0);
    hi - lo
}

fn expected(input: &[Item]) -> Vec<Item> {
    let mut e = input.to_vec();
    e.sort_by_key(|x| x.key);
    e
}

fn describe(input: &[Item]) -> String {
    let keys: Vec<i32> = input.iter().take(24).map(|x| x.key).collect();
    format!(
        "n = {}, keys {:?}{}",
        input.len(),
        keys,
        if input.len() > 24 { " …" } else { "" }
    )
}

fn count_opts() -> Options {
    Options {
        trace: false,
        max_steps: u32::MAX,
        ..Options::default()
    }
}

/// Checks that `entry` sorts `input`: a permutation, keys in order, and for a stable
/// algorithm the tags of equal keys in input order.
pub fn check_one(entry: &Entry, input: &[Item], opt: &Options) -> Result<(), String> {
    let run = engine::run_entry(entry, input.to_vec(), opt);
    match run.outcome {
        Outcome::Sorted => {}
        Outcome::NotASort(_) if matches!(entry.meta.kind, Kind::Joke | Kind::Special) => {
            return Ok(())
        }
        Outcome::Truncated if entry.meta.kind == Kind::Joke => return Ok(()),
        // A range-bound distribution sort may refuse a key range wider than 100 000.
        Outcome::Unsupported(_) if key_span(input) > 100_000 => return Ok(()),
        o => return Err(format!("outcome {o:?} on {}", describe(input))),
    }
    let want = expected(input);
    let got_keys: Vec<i32> = run.output.iter().map(|x| x.key).collect();
    let want_keys: Vec<i32> = want.iter().map(|x| x.key).collect();
    if got_keys != want_keys {
        return Err(format!(
            "wrong order on {}: got {:?}",
            describe(input),
            &got_keys[..got_keys.len().min(24)]
        ));
    }
    let mut a = run.output.clone();
    let mut b = input.to_vec();
    a.sort_by_key(|x| (x.key, x.tag));
    b.sort_by_key(|x| (x.key, x.tag));
    if a != b {
        return Err(format!(
            "output is not a permutation of the input on {}",
            describe(input)
        ));
    }
    if entry.meta.stable == Stability::Yes && run.output != want {
        return Err(format!(
            "equal keys lost their order on {}",
            describe(input)
        ));
    }
    Ok(())
}

/// Random arrays of every small size, a few larger ones, and every preset.
pub fn check_sorts(entry: &Entry, cases: usize) -> Result<(), String> {
    let opt = count_opts();
    let joke = entry.meta.kind == Kind::Joke;
    let jopt = Options {
        trace: false,
        ..Options::default()
    };
    let opt = if joke { &jopt } else { &opt };
    let mut rng = SplitMix64::new(0xC0FFEE ^ entry.meta.id.len() as u64);
    let max_small = if joke { 6 } else { 24 };
    for c in 0..cases {
        let n = (c % (max_small + 1)).max(rng.below(max_small as u64 + 1) as usize);
        let range = match c % 3 {
            0 => (0, 3),
            1 => (-20, 20),
            _ => (-1000, 1000),
        };
        let input = random_input(n, range.0, range.1, rng.next_u64());
        check_one(entry, &input, opt)?;
    }
    if joke {
        return Ok(());
    }
    for (i, &n) in [100usize, 257, 500, 1000, 1500].iter().enumerate() {
        for s in 0..4u64 {
            let input = random_input(n, -2000, 2000, 1000 * i as u64 + s);
            check_one(entry, &input, opt)?;
        }
    }
    for &n in &[0usize, 1, 2, 3, 5, 8, 16, 31, 64, 100, 257, 1000] {
        for (name, input) in presets(n, n as u64 + 1) {
            check_one(entry, &input, opt).map_err(|e| format!("preset {name}: {e}"))?;
        }
    }
    Ok(())
}

/// Many duplicates, tags must stay in input order.
pub fn check_stable(entry: &Entry) -> Result<(), String> {
    let joke = entry.meta.kind == Kind::Joke;
    // joke sorts run with a bounded step budget, real sorts without a limit
    let opt = if joke {
        Options {
            trace: false,
            max_steps: 1_000_000,
            ..Options::default()
        }
    } else {
        count_opts()
    };
    let sizes: &[usize] = if joke {
        &[2, 3, 5, 9]
    } else {
        &[2, 3, 5, 9, 17, 33, 64, 100, 300, 1000, 2000]
    };
    for (c, &n) in sizes.iter().enumerate() {
        for s in 0..6u64 {
            let hi = [1, 2, 4, 10, 50, 1000][s as usize];
            let input = random_input(n, 0, hi, 31 * c as u64 + s);
            let run = engine::run_entry(entry, input.clone(), &opt);
            match run.outcome {
                Outcome::Sorted => {
                    if run.output != expected(&input) {
                        return Err(format!("not stable on {}", describe(&input)));
                    }
                }
                // a joke sort that gave up (step budget, infeasible size) proves nothing
                Outcome::Truncated if joke => {}
                // not a sort by design (Stalin Sort drops, Miracle Sort waits): the elements
                // it keeps must keep their input order among equal keys
                Outcome::NotASort(_) => {
                    if !keeps_equal_key_order(&input, &run.output) {
                        return Err(format!("kept elements reordered on {}", describe(&input)));
                    }
                }
                o => return Err(format!("outcome {o:?} on {}", describe(&input))),
            }
        }
    }
    Ok(())
}

/// True when every pair of equal keys in `output` appears in the order of `input`.
fn keeps_equal_key_order(input: &[Item], output: &[Item]) -> bool {
    use std::collections::HashMap;
    let pos: HashMap<u32, usize> = input.iter().enumerate().map(|(i, x)| (x.tag, i)).collect();
    let mut last: HashMap<i32, usize> = HashMap::new();
    for x in output {
        let Some(&p) = pos.get(&x.tag) else {
            return false;
        };
        if let Some(&q) = last.get(&x.key) {
            if p <= q {
                return false;
            }
        }
        last.insert(x.key, p);
    }
    true
}

/// The aux peak of an in-place algorithm grows at most logarithmically. A constant-size
/// cache (WikiSort's 512 items) is allowed: a peak that grew between n = 256 and n = 2048
/// must stop growing by n = 4096.
pub fn check_in_place(entry: &Entry) -> Result<(), String> {
    let opt = count_opts();
    let peak = |n: usize| {
        presets(n, 3)
            .into_iter()
            .map(|(_, input)| engine::run_entry(entry, input, &opt).counts.aux)
            .max()
            .unwrap_or(0)
    };
    let p1 = peak(256);
    let p2 = peak(2048);
    let fail = |p3: Option<u64>| {
        Err(format!(
            "declared in place but the aux peak is {p1} at n = 256, {p2} at n = 2048{}",
            p3.map(|p| format!(", {p} at n = 4096")).unwrap_or_default()
        ))
    };
    if p2 > 512 + 16 * kit::log2(2048) as u64 {
        return fail(None);
    }
    if p2 > p1 + 64 {
        let p3 = peak(4096);
        if p3 > p2 + 32 {
            return fail(Some(p3));
        }
    }
    Ok(())
}

/// Count-only mode gives the same output and counts as trace mode, and no steps.
pub fn check_trace_parity(entry: &Entry) -> Result<(), String> {
    let sizes: &[usize] = if entry.meta.kind == Kind::Joke {
        &[0, 1, 3, 5]
    } else {
        &[0, 1, 2, 10, 64, 300]
    };
    for &n in sizes {
        for (name, input) in presets(n, 17) {
            let on = Options {
                trace: true,
                max_steps: 100_000,
                ..Options::default()
            };
            let off = Options {
                trace: false,
                ..on.clone()
            };
            let a = engine::run_entry(entry, input.clone(), &on);
            let b = engine::run_entry(entry, input.clone(), &off);
            if a.output != b.output
                || a.counts != b.counts
                || a.truncated != b.truncated
                || a.outcome != b.outcome
            {
                return Err(format!(
                    "{name} n = {n}: trace on {:?} {:?} vs off {:?} {:?}",
                    a.counts, a.outcome, b.counts, b.outcome
                ));
            }
            if b.tracer.recorded() != 0 {
                return Err("count-only mode recorded steps".to_string());
            }
            if !a.truncated && a.tracer.recorded() == 0 && n > 1 {
                return Err(format!("{name} n = {n}: no steps recorded"));
            }
        }
    }
    Ok(())
}

/// Applying the recorded swaps and sets to the input reproduces the output.
pub fn check_replay(entry: &Entry) -> Result<(), String> {
    if entry.meta.kind == Kind::Joke {
        return Ok(());
    }
    for &n in &[2usize, 5, 16, 50, 128] {
        for (name, input) in presets(n, 23) {
            let opt = Options {
                trace: true,
                max_steps: 1_000_000,
                ..Options::default()
            };
            let run = engine::run_entry(entry, input.clone(), &opt);
            if run.truncated || !matches!(run.outcome, Outcome::Sorted) {
                continue;
            }
            let mut v = input.clone();
            for s in run.tracer.steps() {
                match *s {
                    Step::Swap { i, j } => v.swap(i as usize, j as usize),
                    Step::Set { i, key, tag } => v[i as usize] = Item::new(key, tag),
                    _ => {}
                }
            }
            if v != run.output {
                return Err(format!(
                    "{name} n = {n}: replaying swap/set does not give the output"
                ));
            }
        }
    }
    Ok(())
}

pub const BROKEN_MERGE_META: Meta = Meta {
    id: "broken-merge",
    stable: Stability::Yes,
    in_place: false,
    kind: Kind::Comparison,
};
pub const BROKEN_SELECTION_META: Meta = Meta {
    id: "broken-selection",
    stable: Stability::No,
    in_place: true,
    kind: Kind::Comparison,
};

fn merge_sort_with(t: &mut Tracer, v: &mut Vec<Item>, ties_left: bool) {
    fn rec(t: &mut Tracer, v: &mut [Item], lo: usize, hi: usize, ties_left: bool) {
        if hi - lo < 2 {
            return;
        }
        let mid = lo + (hi - lo) / 2;
        rec(t, v, lo, mid, ties_left);
        rec(t, v, mid, hi, ties_left);
        let left: Vec<Item> = v[lo..mid].to_vec();
        let right: Vec<Item> = v[mid..hi].to_vec();
        let (mut i, mut j) = (0, 0);
        for k in lo..hi {
            let take_left = j >= right.len()
                || (i < left.len() && {
                    let o = t.cmp_items(&left[i], &right[j]);
                    if ties_left {
                        o != Ordering::Greater
                    } else {
                        o == Ordering::Less // the swapped comparison
                    }
                });
            let x = if take_left {
                i += 1;
                left[i - 1]
            } else {
                j += 1;
                right[j - 1]
            };
            t.set(v, k, x);
        }
    }
    let n = v.len();
    rec(t, v, 0, n, ties_left);
}

pub fn broken_merge(t: &mut Tracer, v: &mut Vec<Item>, _o: &Options) -> Outcome {
    merge_sort_with(t, v, false);
    Outcome::Sorted
}

pub fn fixed_merge(t: &mut Tracer, v: &mut Vec<Item>, _o: &Options) -> Outcome {
    merge_sort_with(t, v, true);
    Outcome::Sorted
}

pub fn broken_selection(t: &mut Tracer, v: &mut Vec<Item>, _o: &Options) -> Outcome {
    let n = v.len();
    for i in 0..n {
        let mut m = i;
        for j in (i + 1)..n {
            // the correct test is `v[j] < v[m]`; this one is reversed when j is odd
            let better = if j % 2 == 1 {
                t.cmp(v, j, m) == Ordering::Greater
            } else {
                t.less(v, j, m)
            };
            if better {
                m = j;
            }
        }
        t.swap(v, i, m);
    }
    Outcome::Sorted
}
