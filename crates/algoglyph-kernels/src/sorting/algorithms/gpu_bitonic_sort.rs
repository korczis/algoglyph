//! GPU bitonic sort (Batcher 1968 for the network; Kipfer and Westermann 2005, "Improved
//! GPU Sorting", GPU Gems 2, chapter 46, NVIDIA; and the CUDA SDK bitonic sort sample for
//! the kernel structure).
//!
//! The bitonic network, organised as a GPU executes it, one `t.phase` per kernel launch
//! and one `t.lane` per thread (a thread owns one comparator):
//! 1. "local sort" kernel: every thread block loads a tile of 32 keys into shared memory
//!    (`aux`), runs all bitonic stages with blocks of at most 32 there, and stores the
//!    tile back;
//! 2. for every larger merge size k: one global-memory kernel for the flip stage and one
//!    per half-cleaner stage whose distance reaches outside a tile, then a single
//!    "shared-memory merge" kernel that finishes all remaining distances (< 32) inside each
//!    tile -- the classic optimisation that saves kernel launches and global traffic.
//! Every comparator puts the minimum at the lower index (flip form of the network), so for
//! n that is not a power of two the missing inputs act as +infinity and their comparators
//! are omitted. No simplification of the network.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "gpu-bitonic-sort",
    stable: Stability::No,
    in_place: true,
    kind: Kind::Network,
};

const TILE: usize = 32;

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if n < 2 {
        return Outcome::Sorted;
    }
    let big_n = n.next_power_of_two();
    let tile = TILE.min(big_n);
    let mut launch = 0usize;

    launch += 1;
    t.round();
    t.phase(&format!(
        "kernel {launch}: local sort of every tile in shared memory"
    ));
    for (block, base) in (0..n).step_by(tile).enumerate() {
        let mut shared: Vec<Item> = (base..(base + tile).min(n)).map(|i| t.read(v, i)).collect();
        t.aux(&format!("shared memory, block {block}"), &shared);
        let mut k = 2;
        while k <= tile {
            flip(t, &mut shared, k);
            let mut d = k / 4;
            while d >= 1 {
                half_clean(t, &mut shared, d);
                d /= 2;
            }
            k *= 2;
        }
        store(t, v, base, &shared);
        t.aux_clear(&format!("shared memory, block {block}"));
    }
    if !t.ok() {
        return Outcome::Truncated;
    }

    let mut k = 2 * tile;
    while k <= big_n {
        launch += 1;
        t.round();
        t.phase(&format!("kernel {launch}: global flip, blocks of {k}"));
        let mut thread = 0u32;
        for block in (0..big_n).step_by(k) {
            for off in 0..k / 2 {
                let (i, j) = (block + off, block + k - 1 - off);
                if j < n {
                    t.lane(thread);
                    thread += 1;
                    cx(t, v, i, j);
                }
            }
        }
        let mut d = k / 4;
        while d >= tile {
            launch += 1;
            t.round();
            t.phase(&format!(
                "kernel {launch}: global half-cleaner, distance {d}"
            ));
            let mut thread = 0u32;
            for i in 0..n {
                if i & d == 0 && i + d < n {
                    t.lane(thread);
                    thread += 1;
                    cx(t, v, i, i + d);
                }
            }
            d /= 2;
        }
        launch += 1;
        t.round();
        t.phase(&format!(
            "kernel {launch}: shared-memory merge, distances {} .. 1",
            tile / 2
        ));
        for (block, base) in (0..n).step_by(tile).enumerate() {
            let mut shared: Vec<Item> =
                (base..(base + tile).min(n)).map(|i| t.read(v, i)).collect();
            t.aux(&format!("shared memory, block {block}"), &shared);
            let mut d = tile / 2;
            while d >= 1 {
                half_clean(t, &mut shared, d);
                d /= 2;
            }
            store(t, v, base, &shared);
            t.aux_clear(&format!("shared memory, block {block}"));
            t.aux_clear(&format!("shared memory, block {block}"));
        }
        if !t.ok() {
            return Outcome::Truncated;
        }
        k *= 2;
    }
    Outcome::Sorted
}

fn flip(t: &mut Tracer, s: &mut [Item], k: usize) {
    let len = s.len();
    let mut thread = 0u32;
    for block in (0..len).step_by(k) {
        for off in 0..k / 2 {
            let (i, j) = (block + off, block + k - 1 - off);
            if j < len {
                t.lane(thread);
                thread += 1;
                cx_shared(t, s, i, j);
            }
        }
    }
}

fn half_clean(t: &mut Tracer, s: &mut [Item], d: usize) {
    let len = s.len();
    let mut thread = 0u32;
    for i in 0..len {
        if i & d == 0 && i + d < len {
            t.lane(thread);
            thread += 1;
            cx_shared(t, s, i, i + d);
        }
    }
}

fn cx_shared(t: &mut Tracer, s: &mut [Item], i: usize, j: usize) {
    if t.cmp_items(&s[i], &s[j]) == Ordering::Greater {
        s.swap(i, j);
    }
}

fn store(t: &mut Tracer, v: &mut [Item], base: usize, shared: &[Item]) {
    for (k, x) in shared.iter().enumerate() {
        if v[base + k].key != x.key || v[base + k].tag != x.tag {
            t.set(v, base + k, *x);
        }
    }
}

fn cx(t: &mut Tracer, v: &mut [Item], i: usize, j: usize) {
    if t.cmp(v, i, j) == Ordering::Greater {
        t.swap(v, i, j);
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

    #[test]
    fn zero_one_principle_exhaustive() {
        for n in 0..=11usize {
            for mask in 0u32..(1u32 << n) {
                let input = keyed((0..n).map(|i| ((mask >> i) & 1) as i32));
                let (out, outcome, _) = run(&input, &count_only());
                assert_eq!(outcome, Outcome::Sorted);
                assert!(
                    out.windows(2).all(|w| w[0].key <= w[1].key),
                    "n = {n}, mask = {mask:b}"
                );
            }
        }
    }
}
