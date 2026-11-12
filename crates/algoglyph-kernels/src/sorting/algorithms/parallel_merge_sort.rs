//! Parallel merge sort, the block-then-tree formulation (Akl 1985, "Parallel Sorting
//! Algorithms", Academic Press; Cormen, Leiserson, Rivest and Stein, "Introduction to
//! Algorithms", 4th ed., 2022, chapter 26 for the fork-join view).
//!
//! The documented strategy for p processors, one lane each (`t.lane(l)`):
//! 1. local sort: every processor sorts its block of about n/p elements with sequential
//!    merge sort;
//! 2. merge tree: in round r = 1 .. ceil(log2 p) the sorted runs are merged pairwise, all
//!    pairs of a round in parallel (one lane per pair), through an auxiliary buffer, until
//!    one run is left.
//! Stability is a variant property (stable only with consistent tie-breaking); this
//! simulation takes the left run on ties and is stable.
//! Simplification: each pairwise merge is done by one processor; Cole's pipelined merge
//! (Cole 1988) and merge-path splitting of a single merge across processors are not
//! simulated. p = `options.k` when it is at least 2, otherwise 4.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "parallel-merge-sort",
    stable: Stability::Variant,
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
    let mut runs: Vec<(usize, usize)> = (0..p)
        .map(|l| ((l * block).min(n), ((l + 1) * block).min(n)))
        .filter(|&(a, b)| a < b)
        .collect();
    t.round();
    t.phase("round 0: local sort of every block");
    for (l, &(a, b)) in runs.iter().enumerate() {
        t.lane(l as u32);
        merge_sort_range(t, v, a, b);
        if !t.ok() {
            return Outcome::Truncated;
        }
    }
    let mut round = 0;
    while runs.len() > 1 {
        round += 1;
        t.round();
        t.phase(&format!("round {round}: merge pairs of runs"));
        let mut next = Vec::with_capacity(runs.len().div_ceil(2));
        for (pair, chunk) in runs.chunks(2).enumerate() {
            t.lane(pair as u32);
            if chunk.len() == 2 {
                let (lo, mid, hi) = (chunk[0].0, chunk[0].1, chunk[1].1);
                merge(t, v, lo, mid, hi);
                next.push((lo, hi));
            } else {
                next.push(chunk[0]);
            }
            if !t.ok() {
                return Outcome::Truncated;
            }
        }
        runs = next;
    }
    Outcome::Sorted
}

fn merge(t: &mut Tracer, v: &mut [Item], lo: usize, mid: usize, hi: usize) {
    if t.cmp(v, mid - 1, mid) != Ordering::Greater {
        return;
    }
    let left: Vec<Item> = (lo..mid).map(|i| t.read(v, i)).collect();
    t.aux("buffer", &left);
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

fn merge_sort_range(t: &mut Tracer, v: &mut [Item], lo: usize, hi: usize) {
    if hi - lo < 2 {
        return;
    }
    let mid = lo + (hi - lo) / 2;
    merge_sort_range(t, v, lo, mid);
    merge_sort_range(t, v, mid, hi);
    merge(t, v, lo, mid, hi);
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
