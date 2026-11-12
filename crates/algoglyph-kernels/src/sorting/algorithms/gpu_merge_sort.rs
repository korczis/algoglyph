//! GPU merge sort (Satish, Harris and Garland 2009, "Designing efficient sorting
//! algorithms for manycore GPUs", IPDPS 2009; Green, McColl and Bader 2012, "GPU merge
//! path: a GPU merging algorithm", ICS 2012, 331-340).
//!
//! The documented strategy, one `t.phase` per kernel launch, one `t.lane` per thread:
//! 1. block sort: every thread block sorts a tile of 32 keys in shared memory with a
//!    bitonic network (`aux` shows the tile);
//! 2. merge rounds: sorted runs are merged pairwise until one is left. Each merge is split
//!    among threads by Merge Path: thread p takes the output range [p*C, (p+1)*C) and finds,
//!    by a binary search along the cross diagonal, how many elements of each run precede
//!    it (the co-rank); every thread then merges its own slice sequentially, so all threads
//!    work at once without synchronising. Ties go to the left run.
//! Stability is a variant property (stable only with consistent tie-breaking and a stable
//! block sort); this simulation's bitonic block sort makes it unstable. C = 16 elements
//! per thread (real kernels use 256 threads x several elements). No other simplification.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "gpu-merge-sort",
    stable: Stability::Variant,
    in_place: false,
    kind: Kind::Comparison,
};

const TILE: usize = 32;
const PER_THREAD: usize = 16;

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if n < 2 {
        return Outcome::Sorted;
    }
    let mut launch = 1usize;
    t.round();
    t.phase(&format!(
        "kernel {launch}: bitonic block sort of every tile in shared memory"
    ));
    for (block, base) in (0..n).step_by(TILE).enumerate() {
        let mut s: Vec<Item> = (base..(base + TILE).min(n)).map(|i| t.read(v, i)).collect();
        t.aux(&format!("shared memory, block {block}"), &s);
        let len = s.len();
        let mut k = 2;
        while k <= TILE {
            let mut thread = 0u32;
            for blk in (0..len).step_by(k) {
                for off in 0..k / 2 {
                    let (i, j) = (blk + off, blk + k - 1 - off);
                    if j < len {
                        t.lane(thread);
                        thread += 1;
                        cx(t, &mut s, i, j);
                    }
                }
            }
            let mut d = k / 4;
            while d >= 1 {
                let mut thread = 0u32;
                for i in 0..len {
                    if i & d == 0 && i + d < len {
                        t.lane(thread);
                        thread += 1;
                        cx(t, &mut s, i, i + d);
                    }
                }
                d /= 2;
            }
            k *= 2;
        }
        for (k, x) in s.into_iter().enumerate() {
            t.set(v, base + k, x);
        }
        t.aux_clear(&format!("shared memory, block {block}"));
    }
    if !t.ok() {
        return Outcome::Truncated;
    }
    let mut run = TILE;
    while run < n {
        launch += 1;
        t.round();
        t.phase(&format!(
            "kernel {launch}: merge path merge of runs of {run}"
        ));
        let mut out = vec![Item::new(0, 0); n];
        let mut lo = 0;
        while lo < n {
            let mid = (lo + run).min(n);
            let hi = (lo + 2 * run).min(n);
            let a: Vec<Item> = v[lo..mid].to_vec();
            let b: Vec<Item> = v[mid..hi].to_vec();
            let total = hi - lo;
            let threads = total.div_ceil(PER_THREAD);
            for p in 0..threads {
                t.lane(p as u32);
                let d0 = p * PER_THREAD;
                let d1 = ((p + 1) * PER_THREAD).min(total);
                let i0 = co_rank(t, &a, &b, d0);
                let i1 = co_rank(t, &a, &b, d1);
                let (mut i, mut j) = (i0, d0 - i0);
                let j1 = d1 - i1;
                for o in d0..d1 {
                    let take_a = if i < i1 && j < j1 {
                        t.cmp_items(&b[j], &a[i]) != Ordering::Less
                    } else {
                        i < i1
                    };
                    if take_a {
                        out[lo + o] = a[i];
                        i += 1;
                    } else {
                        out[lo + o] = b[j];
                        j += 1;
                    }
                }
            }
            lo = hi;
        }
        t.aux("merged output", &out);
        for (i, x) in out.into_iter().enumerate() {
            t.set(v, i, x);
        }
        t.aux_clear("merged output");
        if !t.ok() {
            return Outcome::Truncated;
        }
        run *= 2;
    }
    Outcome::Sorted
}

/// Number of elements of `a` among the first `d` outputs of the stable merge of a and b.
fn co_rank(t: &mut Tracer, a: &[Item], b: &[Item], d: usize) -> usize {
    let mut lo = d.saturating_sub(b.len());
    let mut hi = d.min(a.len());
    while lo < hi {
        let mid = lo + (hi - lo) / 2;
        if t.cmp_items(&a[mid], &b[d - mid - 1]) != Ordering::Greater {
            lo = mid + 1;
        } else {
            hi = mid;
        }
    }
    lo
}

fn cx(t: &mut Tracer, s: &mut [Item], i: usize, j: usize) {
    if t.cmp_items(&s[i], &s[j]) == Ordering::Greater {
        s.swap(i, j);
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
