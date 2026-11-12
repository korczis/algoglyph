//! AKS sorting network (Ajtai, Komlos and Szemeredi 1983, "An O(n log n) sorting network",
//! STOC 1983, 1-9) -- SIMPLIFIED, labelled as such in the trace.
//!
//! The real AKS network reaches depth O(log n) with epsilon-halvers built from expander
//! graphs and a tree of "separators" whose constants are astronomically large; no
//! practical instance exists and the trace of a faithful one would be unusable. This
//! simulation keeps the two ideas that are visible at small n and says so:
//!
//! 1. "epsilon-halver tree": every segment is approximately halved by an epsilon-halver
//!    between its two halves, then both halves recursively, level by level (the segments of
//!    one level work in parallel). Each halver is a union of 3 perfect matchings between the
//!    halves, given by fixed pseudo-random permutations, which approximate an expander; they
//!    are not certified epsilon-halvers.
//! 2. "cleanup": because those halvers are not certified, a Batcher merge-exchange network
//!    (Knuth, TAOCP Vol. 3, 5.2.2, Algorithm M) follows and guarantees a sorted output.
//!
//! The whole thing is a fixed comparator network (data-oblivious; the matchings depend only
//! on n), simulated round by round with `t.phase` and one `t.lane` per comparator. Its
//! depth is O(log^2 n), not the O(log n) of AKS.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "aks-sorting-network",
    stable: Stability::No,
    in_place: true,
    kind: Kind::Network,
};

const MATCHINGS: u64 = 3;

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if n < 2 {
        return Outcome::Sorted;
    }
    let mut round = 0usize;
    // Level by level: segments of the current level, halved in parallel.
    let mut segments = vec![(0usize, n)];
    let mut level = 0usize;
    while !segments.is_empty() {
        for r in 0..MATCHINGS {
            round += 1;
            t.round();
            t.phase(&format!(
                "round {round}: simplified AKS, epsilon-halver level {level}, matching {}",
                r + 1
            ));
            let mut lane = 0u32;
            for &(lo, hi) in &segments {
                let h = (hi - lo) / 2;
                let mid = hi - h; // first half has the extra element when odd
                let perm = permutation(h, (hi - lo) as u64 * 7919 + r);
                for i in 0..h {
                    t.lane(lane);
                    lane += 1;
                    cx(t, v, lo + i, mid + perm[i]);
                }
            }
            if !t.ok() {
                return Outcome::Truncated;
            }
        }
        let mut next = Vec::new();
        for &(lo, hi) in &segments {
            let mid = hi - (hi - lo) / 2;
            for (a, b) in [(lo, mid), (mid, hi)] {
                if b - a >= 2 {
                    next.push((a, b));
                }
            }
        }
        segments = next;
        level += 1;
    }
    if !batcher_cleanup(t, v, &mut round) {
        return Outcome::Truncated;
    }
    Outcome::Sorted
}

/// Fixed pseudo-random permutation of 0..len (SplitMix64 + Fisher-Yates), independent of
/// the input and of the request's seed, so the network depends on n alone.
fn permutation(len: usize, salt: u64) -> Vec<usize> {
    let mut p: Vec<usize> = (0..len).collect();
    let mut s = salt ^ 0x5DEE_CE66_D1CE_4E5B;
    for i in (1..len).rev() {
        s = s.wrapping_add(0x9E37_79B9_7F4A_7C15);
        let mut z = s;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        z ^= z >> 31;
        p.swap(i, (z % (i as u64 + 1)) as usize);
    }
    p
}

/// Batcher's merge exchange (Knuth's Algorithm M), one round per inner pass.
fn batcher_cleanup(t: &mut Tracer, v: &mut [Item], round: &mut usize) -> bool {
    let n = v.len();
    let tt = usize::BITS - (n - 1).leading_zeros();
    let top = 1usize << (tt - 1);
    let mut p = top;
    while p > 0 {
        let (mut q, mut r, mut d) = (top, 0usize, p);
        loop {
            *round += 1;
            t.round();
            t.phase(&format!(
                "round {}: cleanup (Batcher merge exchange), d = {d}",
                *round
            ));
            let mut lane = 0u32;
            for i in 0..n - d {
                if i & p == r {
                    t.lane(lane);
                    lane += 1;
                    cx(t, v, i, i + d);
                }
            }
            if !t.ok() {
                return false;
            }
            if q == p {
                break;
            }
            d = q - p;
            q /= 2;
            r = p;
        }
        p /= 2;
    }
    true
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
