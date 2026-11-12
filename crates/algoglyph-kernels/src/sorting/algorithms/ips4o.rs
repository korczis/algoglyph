//! In-place Parallel Super Scalar Samplesort, IPS4o (Axtmann, Witt, Ferizovic and Sanders
//! 2017, "In-Place Parallel Super Scalar Samplesort (IPS4o)", ESA 2017, arXiv:1705.02257;
//! official repository https://github.com/ips4o/ips4o).
//!
//! The documented strategy, per recursion level:
//! 1. sampling: draw an oversampled random sample, sort it, pick k - 1 splitters and store
//!    them as an implicit perfect binary search tree;
//! 2. classification: every element descends the tree with log2 k branch-free steps
//!    (`j = 2j + (x > tree[j])`), followed by one equality test, so keys equal to a
//!    splitter land in their own equality bucket that needs no recursion; the t threads
//!    classify their own stripes (`t.lane(l)`) and count bucket sizes;
//! 3. in-place distribution: the elements are moved to their buckets inside the array;
//! 4. recursion into every non-equality bucket; small buckets get insertion sort.
//!
//! Simplification: the real algorithm moves elements in blocks through per-thread buffer
//! blocks, then permutes whole blocks and finishes with a cleanup of the bucket
//! boundaries. Here the distribution is an element-wise cycle-leader permutation (as in
//! American flag sort) that reclassifies each element when it is moved; it is still in
//! place (O(k) extra memory) but not block-wise and not cache-efficient. k = 8 buckets
//! (the real default is up to 256), 4 lanes (`options.k` when it is at least 2).
//!
//! Rounds (`t.round()`): one per step that all lanes run, classification and distribution, at
//! every recursion level as this simulation runs the levels one after another.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "ips4o",
    stable: Stability::No,
    in_place: true,
    kind: Kind::Comparison,
};

const LOG_K: usize = 3;
const K: usize = 1 << LOG_K;
const SMALL: usize = 32;
const OVERSAMPLE: usize = 3;

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, opt: &Options) -> Outcome {
    let lanes = if opt.k >= 2 {
        (opt.k as usize).min(64)
    } else {
        4
    };
    let n = v.len();
    if ips(t, v, 0, n, lanes, 0) {
        Outcome::Sorted
    } else {
        Outcome::Truncated
    }
}

struct Classifier {
    tree: [Item; K],          // tree[1..K], implicit BST
    splitters: [Item; K - 1], // sorted
}

impl Classifier {
    fn new(sorted: &[Item]) -> Self {
        let mut splitters = [Item::new(0, 0); K - 1];
        splitters.copy_from_slice(sorted);
        let mut tree = [Item::new(0, 0); K];
        fn build(tree: &mut [Item; K], s: &[Item], node: usize, lo: usize, hi: usize) {
            if lo >= hi {
                return;
            }
            let mid = lo + (hi - lo) / 2;
            tree[node] = s[mid];
            build(tree, s, 2 * node, lo, mid);
            build(tree, s, 2 * node + 1, mid + 1, hi);
        }
        build(&mut tree, &splitters, 1, 0, K - 1);
        Classifier { tree, splitters }
    }

    /// Bucket in 0..2K-1: even = between splitters, odd = equal to a splitter.
    fn classify(&self, t: &mut Tracer, x: &Item) -> usize {
        let mut j = 1usize;
        for _ in 0..LOG_K {
            j = 2 * j + (t.cmp_items(x, &self.tree[j]) == Ordering::Greater) as usize;
        }
        let b = j - K; // number of splitters < x
        if b < K - 1 && t.cmp_items(x, &self.splitters[b]) != Ordering::Less {
            2 * b + 1
        } else {
            2 * b
        }
    }
}

fn ips(t: &mut Tracer, v: &mut [Item], lo: usize, hi: usize, lanes: usize, depth: usize) -> bool {
    if !t.ok() {
        return false;
    }
    let n = hi - lo;
    if n <= SMALL {
        insertion(t, v, lo, hi);
        return t.ok();
    }
    t.phase(&format!("depth {depth}: sampling"));
    let mut sample: Vec<Item> = (0..OVERSAMPLE * K - 1)
        .map(|_| {
            let i = lo + (t.rng().next_u64() % n as u64) as usize;
            t.read(v, i)
        })
        .collect();
    for i in 1..sample.len() {
        let mut j = i;
        while j > 0 && t.cmp_items(&sample[j - 1], &sample[j]) == Ordering::Greater {
            sample.swap(j - 1, j);
            j -= 1;
        }
    }
    let chosen: Vec<Item> = (1..K).map(|i| sample[i * OVERSAMPLE - 1]).collect();
    t.aux("splitters", &chosen);
    let cl = Classifier::new(&chosen);

    t.round();
    t.phase(&format!(
        "depth {depth}: classification (branch-free decision tree)"
    ));
    let nb = 2 * K - 1;
    let mut count = vec![0usize; nb];
    let stripe = n.div_ceil(lanes);
    for l in 0..lanes {
        t.lane(l as u32);
        for i in (lo + l * stripe).min(hi)..(lo + (l + 1) * stripe).min(hi) {
            let b = cl.classify(t, &v[i]);
            count[b] += 1;
        }
    }
    let mut start = vec![lo; nb + 1];
    for b in 0..nb {
        start[b + 1] = start[b] + count[b];
    }
    t.round();
    t.phase(&format!(
        "depth {depth}: in-place distribution (cycle leader)"
    ));
    let mut next = start.clone();
    for b in 0..nb {
        t.lane(b as u32);
        while next[b] < start[b + 1] {
            let cb = cl.classify(t, &v[next[b]]);
            if cb == b {
                next[b] += 1;
            } else {
                t.swap(v, next[b], next[cb]);
                next[cb] += 1;
            }
        }
        if !t.ok() {
            return false;
        }
    }
    for b in (0..nb).step_by(2) {
        if start[b + 1] - start[b] > 1 {
            t.mark(start[b], start[b + 1], "bucket");
            if !ips(t, v, start[b], start[b + 1], lanes, depth + 1) {
                return false;
            }
        }
    }
    true
}

fn insertion(t: &mut Tracer, v: &mut [Item], lo: usize, hi: usize) {
    for i in lo + 1..hi {
        let mut j = i;
        while j > lo && t.cmp(v, j - 1, j) == Ordering::Greater {
            t.swap(v, j - 1, j);
            j -= 1;
        }
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

    #[test]
    fn in_place_aux_stays_small() {
        let mut r = SplitMix64::new(5);
        let mut peak = |n: usize| {
            let (_, _, t) = run(&random(n, -5000, 5000, &mut r), &count_only());
            t.counts().aux
        };
        let (p1, p2) = (peak(256), peak(2048));
        assert!(
            p2 <= p1 + 64 && p2 <= 512 + 16 * 11,
            "aux peak {p1} -> {p2}"
        );
    }
}
