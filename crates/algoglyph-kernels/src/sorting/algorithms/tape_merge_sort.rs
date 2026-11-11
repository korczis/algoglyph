//! Tape merge sort: the classic three-tape straight merge (Knuth, TAOCP Vol. 3, 2nd ed.,
//! section 5.4.1 and 5.2.4; the "two-way merge with distribution passes" of early tape
//! sorting).
//!
//! Simulation with three tapes A, B, C and a memory of M items (M = ceil(sqrt n), at
//! least 4). Run generation writes sorted memory loads to tape A. Then every pass first
//! distributes the runs of A alternately onto B and C (a copying pass, the cost that
//! balanced merging avoids with more tapes), then merges run i of B with run i of C back
//! onto A, halving the number of runs. `aux` shows the three tapes. Run i of B and run i
//! of C are consecutive runs of A and ties go to B, so the sort is stable.
//! No simplification.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "tape-merge-sort",
    stable: Stability::Variant,
    in_place: false,
    kind: Kind::External,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if n < 2 {
        return Outcome::Sorted;
    }
    let m = memory_size(n);
    t.phase(&format!("run generation onto tape A, memory M = {m}"));
    let mut a = generate_runs(t, v, m);
    show_tape(t, "tape A", &a);
    let mut pass = 0;
    while a.len() > 1 {
        if !t.ok() {
            return Outcome::Truncated;
        }
        pass += 1;
        t.phase(&format!(
            "pass {pass}: distribute the {} runs of A onto B and C",
            a.len()
        ));
        let (mut b, mut c) = (Vec::new(), Vec::new());
        for (i, r) in a.drain(..).enumerate() {
            if i % 2 == 0 {
                b.push(r);
            } else {
                c.push(r);
            }
        }
        show_tape(t, "tape A", &a);
        show_tape(t, "tape B", &b);
        show_tape(t, "tape C", &c);
        t.phase(&format!("pass {pass}: merge B and C back onto A"));
        let mut cit = c.into_iter();
        for rb in b {
            match cit.next() {
                Some(rc) => a.push(kway_merge(t, &[rb, rc])),
                None => a.push(rb),
            }
        }
        t.aux_clear("tape B");
        t.aux_clear("tape C");
        show_tape(t, "tape A", &a);
    }
    t.phase("write the sorted file");
    write_out(t, v, &a[0]);
    t.aux_clear("tape A");
    Outcome::Sorted
}

/// Memory size M of the simulation: ceil(sqrt n), at least 4 items.
fn memory_size(n: usize) -> usize {
    let mut m = 4;
    while m * m < n {
        m += 1;
    }
    m
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

/// Run generation: reads the input in memory loads of `m`, sorts each load in memory and
/// writes it out as a run.
fn generate_runs(t: &mut Tracer, v: &[Item], m: usize) -> Vec<Vec<Item>> {
    let n = v.len();
    let mut runs = Vec::with_capacity(n.div_ceil(m));
    let mut start = 0;
    while start < n {
        let end = (start + m).min(n);
        t.mark(start, end, "memory load");
        let mut load: Vec<Item> = (start..end).map(|i| t.read(v, i)).collect();
        t.aux("memory", &load);
        mem_sort(t, &mut load);
        t.aux("memory", &load);
        runs.push(load);
        start = end;
    }
    t.aux_clear("memory");
    runs
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
