//! Polyphase merge sort (Gilstad 1960, "Polyphase merge sorting -- an advanced technique",
//! Proceedings of the Eastern Joint Computer Conference 18, 143-148; Knuth, TAOCP Vol. 3,
//! 2nd ed., section 5.4.2, Algorithm D).
//!
//! Simulation with T = P + 1 tapes (P = `options.k` when it is at least 2, otherwise 2, so
//! 3 tapes by default) and a memory of M items (M = ceil(sqrt n), at least 4). The sorted
//! memory loads are distributed over the P input tapes in the real perfect distribution:
//! the smallest level of the generalised Fibonacci numbers of order P whose total is at
//! least the number of runs (level l + 1 from level l: a1 + a2, a1 + a3, ..., a1 + aP, a1),
//! padded with dummy (empty) runs spread round-robin over the tapes. Every phase merges one
//! run from each input tape onto the empty tape until the shortest input tape is empty;
//! that tape becomes the output of the next phase. `aux` shows every tape (dummy runs are
//! empty). Simplification: dummy runs are placed at the front of the tapes rather than by
//! Algorithm D's horizontal distribution; the counts per tape are the real ones.
use crate::sorting::prelude::*;
use std::collections::VecDeque;

pub const META: Meta = Meta {
    id: "polyphase-merge-sort",
    stable: Stability::No,
    in_place: false,
    kind: Kind::External,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, opt: &Options) -> Outcome {
    let n = v.len();
    if n < 2 {
        return Outcome::Sorted;
    }
    let m = memory_size(n);
    let p = ways(opt, 2);
    let tapes_n = p + 1;
    t.phase(&format!("run generation, memory M = {m}"));
    let runs = generate_runs(t, v, m);
    // Perfect distribution of order p.
    let mut level = vec![0usize; p];
    level[0] = 1;
    let mut lv = 0;
    while level.iter().sum::<usize>() < runs.len() {
        let a1 = level[0];
        let mut next: Vec<usize> = (0..p - 1).map(|i| a1 + level[i + 1]).collect();
        next.push(a1);
        level = next;
        lv += 1;
    }
    let total: usize = level.iter().sum();
    let mut dummies = vec![0usize; p];
    let mut left = total - runs.len();
    while left > 0 {
        for i in 0..p {
            if left > 0 && dummies[i] < level[i] {
                dummies[i] += 1;
                left -= 1;
            }
        }
    }
    t.phase(&format!(
        "distribution: level {lv} of order {p}: {level:?} runs, {} of them dummy",
        total - runs.len()
    ));
    let mut tapes: Vec<VecDeque<Vec<Item>>> = vec![VecDeque::new(); tapes_n];
    let mut it = runs.into_iter();
    for i in 0..p {
        for _ in 0..dummies[i] {
            tapes[i].push_back(Vec::new());
        }
        for _ in dummies[i]..level[i] {
            tapes[i].push_back(it.next().unwrap_or_default());
        }
    }
    show_all(t, &tapes);
    let mut out = p;
    let mut phase = 0;
    while tapes.iter().map(|tp| tp.len()).sum::<usize>() > 1 {
        if !t.ok() {
            return Outcome::Truncated;
        }
        phase += 1;
        let inputs: Vec<usize> = (0..tapes_n).filter(|&i| i != out).collect();
        let merges = inputs.iter().map(|&i| tapes[i].len()).min().unwrap_or(0);
        t.phase(&format!(
            "phase {phase}: {merges} merges of {p} runs onto tape {}",
            out + 1
        ));
        for _ in 0..merges {
            let group: Vec<Vec<Item>> = inputs
                .iter()
                .map(|&i| tapes[i].pop_front().unwrap_or_default())
                .collect();
            let merged = kway_merge(t, &group);
            tapes[out].push_back(merged);
        }
        show_all(t, &tapes);
        out = inputs
            .into_iter()
            .find(|&i| tapes[i].is_empty())
            .unwrap_or(out);
    }
    let last = tapes
        .into_iter()
        .flatten()
        .find(|r| !r.is_empty())
        .unwrap_or_default();
    t.phase("write the sorted file");
    write_out(t, v, &last);
    for i in 0..tapes_n {
        t.aux_clear(&format!("tape {}", i + 1));
    }
    Outcome::Sorted
}

fn show_all(t: &mut Tracer, tapes: &[VecDeque<Vec<Item>>]) {
    for (i, tp) in tapes.iter().enumerate() {
        show_tape(t, &format!("tape {}", i + 1), tp.iter());
    }
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
