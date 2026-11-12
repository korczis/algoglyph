//! Burnt pancake sort (Gates and Papadimitriou 1979, "Bounds for sorting by prefix
//! reversal", Discrete Mathematics 27(1), 47-57; Cohen and Blum 1995, "On the problem of
//! sorting burnt pancakes", Discrete Applied Mathematics 61(2), 105-120).
//!
//! Every pancake has a burnt side, and a flip reverses the top k pancakes and turns each of
//! them over. The goal is the sorted stack with every burnt side down. The simple algorithm
//! used here places the largest unsorted pancake at the bottom of the unsorted part, burnt
//! side down, with at most three flips: flip it to the top, flip it alone if its burnt side
//! is then down (the next flip turns it), then flip the whole unsorted part; at most 3n
//! flips (Cohen and Blum show 2n - 2 suffice with a better strategy).
//!
//! Orientation is carried in bit 31 of the tag (set = burnt side up) while sorting, so it is
//! visible in every `set` of the trace; a flip is a `t.phase("flip k")` of swaps followed by
//! the sets that turn the pancakes over. The initial orientation is read from bit 31 of the
//! input tags when any is set, otherwise it is drawn from the seeded generator. At the end
//! every burnt side is down, so every tag is back to its original value.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "burnt-pancake-sort",
    stable: Stability::No,
    in_place: true,
    kind: Kind::Special,
};

const UP: u32 = 1 << 31;

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if n == 0 {
        return Outcome::Sorted;
    }
    if !v.iter().any(|x| x.tag & UP != 0) {
        t.phase("random initial orientation (bit 31 of the tag = burnt side up)");
        for i in 0..n {
            if t.rng().below(2) == 1 {
                let x = v[i];
                t.set(v, i, Item::new(x.key, x.tag | UP));
            }
        }
    }
    let mut flips = 0;
    for size in (1..=n).rev() {
        if !t.ok() {
            return Outcome::Truncated;
        }
        let mut best = 0;
        for i in 1..size {
            if t.cmp(v, i, best) != Ordering::Less {
                best = i;
            }
        }
        if best == size - 1 && v[best].tag & UP == 0 {
            continue; // already in place, burnt side down
        }
        if best != 0 {
            flips += 1;
            flip(t, v, best + 1, flips);
        }
        // The final flip of `size` turns the top pancake over: it must be burnt side up now.
        if v[0].tag & UP == 0 {
            flips += 1;
            flip(t, v, 1, flips);
        }
        flips += 1;
        flip(t, v, size, flips);
    }
    Outcome::Sorted
}

fn flip(t: &mut Tracer, v: &mut [Item], k: usize, count: usize) {
    t.phase(&format!("flip {count}: reverse and turn over the top {k}"));
    t.mark(0, k, "flip");
    let (mut i, mut j) = (0, k - 1);
    while i < j {
        t.swap(v, i, j);
        i += 1;
        j -= 1;
    }
    for i in 0..k {
        let x = v[i];
        t.set(v, i, Item::new(x.key, x.tag ^ UP));
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

    const MAX_N: usize = 300;

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
    fn ends_with_every_burnt_side_down() {
        let mut r = SplitMix64::new(6);
        let input = random(40, -9, 9, &mut r);
        let opt = Options {
            max_steps: 1_000_000,
            ..Options::default()
        };
        let (out, o, t) = run(&input, &opt);
        assert_eq!(o, Outcome::Sorted);
        assert!(out.iter().all(|x| x.tag & (1 << 31) == 0));
        assert!(t
            .steps()
            .iter()
            .any(|s| matches!(s, Step::Set { tag, .. } if tag & (1 << 31) != 0)));
    }
}
