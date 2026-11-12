//! Oscillating merge sort (Sobel 1962, "Oscillating sort -- a new sort merging technique",
//! Journal of the ACM 9(3), 372-374; Knuth, TAOCP Vol. 3, 2nd ed., section 5.4.5).
//!
//! The oscillating sort does not separate distribution from merging: it reads a little
//! input, merges as soon as enough runs exist, and reads more, so the tapes "oscillate"
//! between being written forwards and read backwards. With W work tapes (W = P + 1, fan-in
//! P = `options.k` when it is at least 2, otherwise 3, so 5 tapes in all with the input
//! tape, Sobel's setting), producing a run of level l on tape T means: produce one run of
//! level l - 1 on each of the other P work tapes (recursively, using T among them), then
//! merge those P runs, read backwards, onto T. A level-0 run is one memory load (M =
//! ceil(sqrt n), at least 4) read from the input and sorted. Read-backward tapes behave as
//! stacks, which is how they are simulated; `aux` shows every work tape.
//! Simplification: the alternation of ascending and descending runs that backward reading
//! causes is not represented (runs are kept ascending), and when the input runs out early,
//! the missing runs are empty (dummy) runs.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "oscillating-merge-sort",
    stable: Stability::No,
    in_place: false,
    kind: Kind::External,
};

struct Machine {
    tapes: Vec<Vec<Vec<Item>>>, // stacks of runs
    next: usize,                // next unread input position
    m: usize,
}

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, opt: &Options) -> Outcome {
    let n = v.len();
    if n < 2 {
        return Outcome::Sorted;
    }
    let m = memory_size(n);
    let p = ways(opt, 3);
    let w = p + 1;
    let runs = n.div_ceil(m);
    let mut levels = 0;
    let mut cap = 1usize;
    while cap < runs {
        cap = cap.saturating_mul(p);
        levels += 1;
    }
    t.phase(&format!(
        "{w} work tapes, fan-in {p}, memory M = {m}, {levels} levels"
    ));
    let mut mach = Machine {
        tapes: vec![Vec::new(); w],
        next: 0,
        m,
    };
    if !produce(t, v, &mut mach, levels, 0) {
        return Outcome::Truncated;
    }
    let last = mach.tapes[0].pop().unwrap_or_default();
    t.phase("write the sorted file");
    write_out(t, v, &last);
    for i in 0..w {
        t.aux_clear(&format!("work tape {}", i + 1));
    }
    Outcome::Sorted
}

fn produce(t: &mut Tracer, v: &[Item], mach: &mut Machine, level: usize, target: usize) -> bool {
    if !t.ok() {
        return false;
    }
    if level == 0 {
        let (start, end) = (mach.next, (mach.next + mach.m).min(v.len()));
        let mut load: Vec<Item> = (start..end).map(|i| t.read(v, i)).collect();
        mach.next = end;
        if !load.is_empty() {
            t.phase(&format!(
                "read and sort a memory load onto work tape {}",
                target + 1
            ));
            t.mark(start, end, "memory load");
            mem_sort(t, &mut load);
        }
        mach.tapes[target].push(load);
        show_tape(
            t,
            &format!("work tape {}", target + 1),
            mach.tapes[target].iter(),
        );
        return true;
    }
    let sources: Vec<usize> = (0..mach.tapes.len()).filter(|&i| i != target).collect();
    for &s in &sources {
        if !produce(t, v, mach, level - 1, s) {
            return false;
        }
    }
    t.phase(&format!(
        "merge level-{} runs read backwards onto work tape {}",
        level - 1,
        target + 1
    ));
    let group: Vec<Vec<Item>> = sources
        .iter()
        .map(|&s| mach.tapes[s].pop().unwrap_or_default())
        .collect();
    for &s in &sources {
        show_tape(t, &format!("work tape {}", s + 1), mach.tapes[s].iter());
    }
    let merged = kway_merge(t, &group);
    mach.tapes[target].push(merged);
    show_tape(
        t,
        &format!("work tape {}", target + 1),
        mach.tapes[target].iter(),
    );
    true
}

/// Memory size M of the simulation: ceil(sqrt n), at least 4 items.
fn memory_size(n: usize) -> usize {
    let mut m = 4;
    while m * m < n {
        m += 1;
    }
    m
}

/// Fan-in / number of ways: `options.k` when it is at least 2, otherwise `default`.
fn ways(opt: &Options, default: usize) -> usize {
    if opt.k >= 2 {
        (opt.k as usize).min(64)
    } else {
        default
    }
}

/// Stable in-memory merge sort of one memory load.
fn mem_sort(t: &mut Tracer, a: &mut [Item]) {
    let n = a.len();
    if n < 2 {
        return;
    }
    let mid = n / 2;
    mem_sort(t, &mut a[..mid]);
    mem_sort(t, &mut a[mid..]);
    if t.cmp_items(&a[mid - 1], &a[mid]) != Ordering::Greater {
        return;
    }
    let left = a[..mid].to_vec();
    let (mut i, mut j, mut k) = (0, mid, 0);
    while i < left.len() && j < n {
        if t.cmp_items(&a[j], &left[i]) == Ordering::Less {
            a[k] = a[j];
            j += 1;
        } else {
            a[k] = left[i];
            i += 1;
        }
        k += 1;
    }
    while i < left.len() {
        a[k] = left[i];
        i += 1;
        k += 1;
    }
}

/// Stable k-way merge of sorted runs (ties go to the lower run), selecting the smallest
/// head by a scan of the k heads.
fn kway_merge(t: &mut Tracer, runs: &[Vec<Item>]) -> Vec<Item> {
    let mut idx = vec![0usize; runs.len()];
    let total: usize = runs.iter().map(|r| r.len()).sum();
    let mut out = Vec::with_capacity(total);
    while out.len() < total {
        let mut best: Option<usize> = None;
        for (r, run) in runs.iter().enumerate() {
            if idx[r] >= run.len() {
                continue;
            }
            best = match best {
                None => Some(r),
                Some(b) if t.cmp_items(&run[idx[r]], &runs[b][idx[b]]) == Ordering::Less => Some(r),
                keep => keep,
            };
        }
        let b = best.expect("a run with items left");
        out.push(runs[b][idx[b]]);
        idx[b] += 1;
    }
    out
}

/// Writes the final run back to the array.
fn write_out(t: &mut Tracer, v: &mut [Item], run: &[Item]) {
    for (i, x) in run.iter().enumerate() {
        t.set(v, i, *x);
    }
}

/// Snapshot of a tape: its runs concatenated.
fn show_tape<'a>(t: &mut Tracer, name: &str, runs: impl IntoIterator<Item = &'a Vec<Item>>) {
    let flat: Vec<Item> = runs.into_iter().flatten().copied().collect();
    t.aux(name, &flat);
}

#[cfg(test)]
mod tests {
    use super::*;

    fn run(input: &[Item], opt: &Options) -> (Vec<Item>, Outcome, Tracer) {
        let mut t = Tracer::new(opt);
        let mut v = input.to_vec();
        let o = sort(&mut t, &mut v, opt);
        (v, o, t)
    }

    fn count_only() -> Options {
        Options {
            trace: false,
            max_steps: u32::MAX,
            ..Options::default()
        }
    }

    fn random(n: usize, lo: i64, hi: i64, r: &mut SplitMix64) -> Vec<Item> {
        (0..n)
            .map(|i| Item::new((lo + r.below((hi - lo + 1) as u64) as i64) as i32, i as u32))
            .collect()
    }

    fn keyed(keys: impl IntoIterator<Item = i32>) -> Vec<Item> {
        keys.into_iter()
            .enumerate()
            .map(|(i, k)| Item::new(k, i as u32))
            .collect()
    }

    const MAX_N: usize = 1000;

    fn inputs(max_n: usize) -> Vec<Vec<Item>> {
        let mut r = SplitMix64::new(0x7E57_5EED);
        let mut all = Vec::new();
        let sizes = [
            0usize, 1, 2, 3, 4, 5, 7, 8, 9, 13, 16, 17, 31, 33, 64, 100, 257, max_n,
        ];
        for &n in sizes.iter().filter(|&&n| n <= max_n) {
            let ni = n as i32;
            for &(lo, hi) in &[(0i64, 3i64), (-50, 50), (-100_000, 100_000)] {
                for _ in 0..3 {
                    all.push(random(n, lo, hi, &mut r));
                }
            }
            all.push(keyed(0..ni));
            all.push(keyed((0..ni).rev()));
            all.push(keyed((0..ni).map(|_| 7)));
            all.push(keyed((0..ni).map(|i| i.min(ni - 1 - i))));
            all.push(keyed((0..ni).map(|i| match i % 4 {
                0 => i32::MAX,
                1 => i32::MIN,
                2 => 0,
                _ => i * 1000,
            })));
        }
        all
    }

    fn check(input: &[Item]) {
        let (out, outcome, _) = run(input, &count_only());
        let span = input.iter().map(|x| x.key as i64).max().unwrap_or(0)
            - input.iter().map(|x| x.key as i64).min().unwrap_or(0);
        if matches!(outcome, Outcome::Unsupported(_)) && span > 100_000 {
            assert_eq!(out, input, "unsupported input must be left unchanged");
            return;
        }
        assert_eq!(outcome, Outcome::Sorted, "outcome on n = {}", input.len());
        let mut want = input.to_vec();
        want.sort_by_key(|x| x.key);
        let got: Vec<i32> = out.iter().map(|x| x.key).collect();
        let exp: Vec<i32> = want.iter().map(|x| x.key).collect();
        assert_eq!(got, exp, "order on n = {}", input.len());
        let mut a = out.clone();
        let mut b = input.to_vec();
        a.sort_by_key(|x| (x.key, x.tag));
        b.sort_by_key(|x| (x.key, x.tag));
        assert_eq!(a, b, "not a permutation on n = {}", input.len());
        if META.stable == Stability::Yes {
            assert_eq!(
                out,
                want,
                "equal keys lost their order on n = {}",
                input.len()
            );
        }
    }

    #[test]
    fn sorts_random_and_adversarial_inputs() {
        for input in inputs(MAX_N) {
            check(&input);
        }
    }

    #[test]
    fn stable_when_declared_or_at_least_correct_on_duplicates() {
        let mut r = SplitMix64::new(99);
        for &n in &[2usize, 9, 33, 100, 300] {
            for &hi in &[1i64, 2, 4, 10] {
                check(&random(n, 0, hi, &mut r));
            }
        }
    }

    #[test]
    fn step_limit_truncates() {
        let input = random(300, 0, 1000, &mut SplitMix64::new(11));
        let opt = Options {
            max_steps: 50,
            ..Options::default()
        };
        let (_, outcome, t) = run(&input, &opt);
        assert!(t.truncated() || outcome == Outcome::Truncated);
        assert!(t.steps().len() <= 50);
    }

    #[test]
    fn trace_replays_to_the_output_and_matches_count_only() {
        let input = random(50, -20, 20, &mut SplitMix64::new(23));
        let opt = Options {
            max_steps: 1_000_000,
            ..Options::default()
        };
        let (out, outcome, t) = run(&input, &opt);
        assert_eq!(outcome, Outcome::Sorted);
        let mut v = input.clone();
        for s in t.steps() {
            match *s {
                Step::Swap { i, j } => v.swap(i as usize, j as usize),
                Step::Set { i, key, tag } => v[i as usize] = Item::new(key, tag),
                _ => {}
            }
        }
        assert_eq!(v, out, "replaying swap/set does not give the output");
        let (out2, _, t2) = run(&input, &count_only());
        assert_eq!(out2, out);
        assert_eq!(t2.counts(), t.counts());
    }
}
