//! Parallel Sorting by Regular Sampling (Shi and Schaeffer 1992, "Parallel sorting by
//! regular sampling", Journal of Parallel and Distributed Computing 14(4), 361-372; Li,
//! Lu, Schaeffer, Shillington, Wong and Shi 1993, "On the versatility of parallel sorting
//! by regular sampling", Parallel Computing 19(10), 1079-1103).
//!
//! The documented strategy for p processors, one lane each (`t.lane(l)`), in phases:
//! 1. local sort: every processor sorts its block of about n/p elements;
//! 2. regular sampling: every processor takes p samples at positions 0, n/p^2, 2n/p^2, ...
//!    of its sorted block;
//! 3. pivots: the p^2 samples are gathered and sorted, and p - 1 pivots are taken at
//!    positions p + rho - 1, 2p + rho - 1, ... with rho = floor(p / 2);
//! 4. partition: every processor splits its sorted block at the pivots (binary search);
//! 5. exchange: processor i receives the i-th piece of every processor;
//! 6. merge: every processor merges its p sorted pieces (a p-way merge);
//! 7. the processors' results, in order, are the sorted output.
//! Ties in the p-way merge go to the lower processor, so this simulation happens to be
//! stable; PSRS is not specified as stable and META declares it unstable.
//! p = `options.k` when it is at least 2, otherwise 4. No simplification.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "psrs",
    stable: Stability::No,
    in_place: false,
    kind: Kind::Comparison,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, opt: &Options) -> Outcome {
    let n = v.len();
    let p = if opt.k >= 2 {
        (opt.k as usize).min(64)
    } else {
        4
    };
    if n < 2 {
        return Outcome::Sorted;
    }
    let block = n.div_ceil(p);
    let bounds: Vec<(usize, usize)> = (0..p)
        .map(|l| ((l * block).min(n), ((l + 1) * block).min(n)))
        .collect();

    t.phase("phase 1: local sort");
    for (l, &(a, b)) in bounds.iter().enumerate() {
        t.lane(l as u32);
        merge_sort_range(t, v, a, b);
        if !t.ok() {
            return Outcome::Truncated;
        }
    }

    t.phase("phase 2: regular sampling");
    let mut samples = Vec::with_capacity(p * p);
    for (l, &(a, b)) in bounds.iter().enumerate() {
        t.lane(l as u32);
        let len = b - a;
        for j in 0..p {
            if len > 0 {
                samples.push(t.read(v, a + j * len / p));
            }
        }
    }
    t.phase("phase 3: sort the samples, choose p - 1 pivots");
    merge_sort(t, &mut samples);
    let rho = p / 2;
    let pivots: Vec<Item> = (1..p)
        .map(|i| samples[(i * p + rho).saturating_sub(1).min(samples.len() - 1)])
        .collect();
    t.aux("pivots", &pivots);

    t.phase("phase 4: partition every sorted block at the pivots");
    // cut[l][i] = start of piece i in block l; piece i is [cut[l][i], cut[l][i + 1]).
    let mut cuts: Vec<Vec<usize>> = Vec::with_capacity(p);
    for (l, &(a, b)) in bounds.iter().enumerate() {
        t.lane(l as u32);
        let mut c = vec![a];
        for pv in &pivots {
            let start = *c.last().unwrap();
            c.push(upper_bound(t, v, start, b, pv));
        }
        c.push(b);
        cuts.push(c);
    }

    t.phase("phase 5: exchange the pieces");
    let mut pieces: Vec<Vec<Vec<Item>>> = vec![Vec::with_capacity(p); p]; // [receiver][sender]
    for (l, c) in cuts.iter().enumerate() {
        t.lane(l as u32);
        for i in 0..p {
            let piece: Vec<Item> = (c[i]..c[i + 1]).map(|q| t.read(v, q)).collect();
            pieces[i].push(piece);
        }
    }
    if !t.ok() {
        return Outcome::Truncated;
    }

    t.phase("phase 6: every processor merges its p pieces");
    let mut pos = 0;
    for (i, recv) in pieces.iter().enumerate() {
        t.lane(i as u32);
        let merged = multiway_merge(t, recv);
        t.aux(&format!("processor {i}"), &merged);
        for x in merged {
            t.set(v, pos, x);
            pos += 1;
        }
        if !t.ok() {
            return Outcome::Truncated;
        }
    }
    Outcome::Sorted
}

/// Stable p-way merge: on equal keys the lower piece wins.
fn multiway_merge(t: &mut Tracer, runs: &[Vec<Item>]) -> Vec<Item> {
    let mut idx = vec![0usize; runs.len()];
    let total: usize = runs.iter().map(|r| r.len()).sum();
    let mut out = Vec::with_capacity(total);
    while out.len() < total {
        let mut best: Option<usize> = None;
        for (r, run) in runs.iter().enumerate() {
            if idx[r] < run.len() {
                best = match best {
                    None => Some(r),
                    Some(b) => {
                        if t.cmp_items(&run[idx[r]], &runs[b][idx[b]]) == Ordering::Less {
                            Some(r)
                        } else {
                            Some(b)
                        }
                    }
                };
            }
        }
        let b = best.unwrap();
        out.push(runs[b][idx[b]]);
        idx[b] += 1;
    }
    out
}

/// First index in [lo, hi) whose key is greater than `x`.
fn upper_bound(t: &mut Tracer, v: &[Item], mut lo: usize, mut hi: usize, x: &Item) -> usize {
    while lo < hi {
        let mid = lo + (hi - lo) / 2;
        if t.cmp_items(x, &v[mid]) == Ordering::Less {
            hi = mid;
        } else {
            lo = mid + 1;
        }
    }
    lo
}

/// Stable top-down merge sort of v[lo..hi) through a temporary buffer.
fn merge_sort_range(t: &mut Tracer, v: &mut [Item], lo: usize, hi: usize) {
    if hi - lo < 2 {
        return;
    }
    let mid = lo + (hi - lo) / 2;
    merge_sort_range(t, v, lo, mid);
    merge_sort_range(t, v, mid, hi);
    if t.cmp(v, mid - 1, mid) != Ordering::Greater {
        return;
    }
    let left: Vec<Item> = (lo..mid).map(|i| t.read(v, i)).collect();
    let (mut i, mut j, mut k) = (0, mid, lo);
    while i < left.len() && j < hi {
        if t.cmp_items(&v[j], &left[i]) == Ordering::Less {
            let x = v[j];
            t.set(v, k, x);
            j += 1;
        } else {
            t.set(v, k, left[i]);
            i += 1;
        }
        k += 1;
    }
    while i < left.len() {
        t.set(v, k, left[i]);
        i += 1;
        k += 1;
    }
}

fn merge_sort(t: &mut Tracer, a: &mut [Item]) {
    let n = a.len();
    if n < 2 {
        return;
    }
    let mid = n / 2;
    merge_sort(t, &mut a[..mid]);
    merge_sort(t, &mut a[mid..]);
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
