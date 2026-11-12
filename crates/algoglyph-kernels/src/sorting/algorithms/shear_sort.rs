//! Shear sort (Scherson, Sen and Shamir 1986, "Shear sort: A true two-dimensional sorting
//! technique for VLSI networks", ICPP 1986, 903-908; Leighton 1992, "Introduction to
//! Parallel Algorithms and Architectures", Morgan Kaufmann).
//!
//! The input is laid out on an r x c mesh (c = ceil(sqrt n), r = ceil(n / c)). Each of the
//! ceil(log2 r) phases sorts all rows in snake order (even rows ascending, odd rows
//! descending), then all columns top to bottom; a final row phase finishes. Rows and
//! columns are sorted by odd-even transposition, the mesh's own local operation, so every
//! transposition step is one parallel round (`t.phase("round r")`) and every row or column
//! is a lane (`t.lane(k)`).
//!
//! Layout: cell (i, j) lives at index i * c + j for even rows and i * c + (c - 1 - j) for odd
//! rows (boustrophedon), so the snake order of the mesh is the order of the array and the
//! sorted mesh is the sorted array. Missing cells of a partial last row are +infinity; they
//! never move under these operations, so the comparators touching them are omitted.
//! No simplification.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "shear-sort",
    stable: Stability::No,
    in_place: true,
    kind: Kind::Network,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if n < 2 {
        return Outcome::Sorted;
    }
    let mut c = 1usize;
    while c * c < n {
        c += 1;
    }
    let r = n.div_ceil(c);
    let idx = |i: usize, j: usize| {
        if i % 2 == 0 {
            i * c + j
        } else {
            i * c + (c - 1 - j)
        }
    };
    // ceil(lg r) row+column phases, then a final row phase
    let phases = (usize::BITS - (r - 1).leading_zeros()) as usize;
    let mut round = 0usize;
    for ph in 0..=phases {
        // Rows (snake order): in array terms every row segment is ascending.
        for step in 0..c {
            round += 1;
            t.round();
            t.phase(&format!(
                "round {round}: phase {} row sort, step {step}",
                ph + 1
            ));
            for i in 0..r {
                t.lane(i as u32);
                let mut p = step % 2;
                while p + 1 < c {
                    let (a, b) = (i * c + p, i * c + p + 1);
                    if b < n {
                        cx(t, v, a, b);
                    }
                    p += 2;
                }
            }
            if !t.ok() {
                return Outcome::Truncated;
            }
        }
        if ph == phases {
            break;
        }
        for step in 0..r {
            round += 1;
            t.round();
            t.phase(&format!(
                "round {round}: phase {} column sort, step {step}",
                ph + 1
            ));
            for j in 0..c {
                t.lane(j as u32);
                let mut i = step % 2;
                while i + 1 < r {
                    let (a, b) = (idx(i, j), idx(i + 1, j));
                    if a < n && b < n {
                        cx(t, v, a, b);
                    }
                    i += 2;
                }
            }
            if !t.ok() {
                return Outcome::Truncated;
            }
        }
    }
    Outcome::Sorted
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
