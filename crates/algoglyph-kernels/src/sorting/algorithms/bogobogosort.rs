//! Bogobogosort (David Morgan-Mar, "Bogobogosort", DangerMouse.net esoteric programming
//! pages, https://www.dangermouse.net/esoteric/bogobogosort.html).
//!
//! Defined recursively: to sort n elements, bogobogosort the first n - 1; if the n-th
//! element is not smaller than the (now largest) (n - 1)-th, the whole list is sorted;
//! otherwise shuffle all n elements and start again, including the recursive sort of the
//! first n - 1. The expected running time grows far faster than bogosort's, so the run is
//! bounded: after 2 000 shuffles in total, or when the step limit is reached, it stops
//! with `Outcome::Truncated`.
//! Simplification: Morgan-Mar's version works on a copy and finally checks that the copy
//! is in the same order as the original; the simulation sorts the array itself and omits
//! that final comparison.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "bogobogosort",
    stable: Stability::No,
    in_place: false,
    kind: Kind::Joke,
};

const MAX_SHUFFLES: u32 = 2_000;

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    let mut shuffles = 0u32;
    if bbs(t, v, n, &mut shuffles) {
        Outcome::Sorted
    } else {
        t.phase("gave up: shuffle or step limit reached");
        Outcome::Truncated
    }
}

/// Sorts the prefix of length `m`; false when the budget runs out.
fn bbs(t: &mut Tracer, v: &mut [Item], m: usize, shuffles: &mut u32) -> bool {
    if m <= 1 {
        return true;
    }
    loop {
        if !t.ok() || *shuffles >= MAX_SHUFFLES {
            return false;
        }
        if !bbs(t, v, m - 1, shuffles) {
            return false;
        }
        if t.cmp(v, m - 2, m - 1) != Ordering::Greater {
            return true;
        }
        *shuffles += 1;
        t.phase(&format!(
            "prefix of {m}: last element too small, shuffle {}",
            *shuffles
        ));
        for i in (1..m).rev() {
            let j = t.rng().range(0, i + 1);
            t.swap(v, i, j);
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

    #[test]
    fn small_inputs_are_sorted_or_truncated() {
        let mut r = SplitMix64::new(0xB060);
        let opt = Options {
            trace: false,
            ..Options::default()
        };
        for n in 0..=5usize {
            for _ in 0..40 {
                let input = random(n, -3, 3, &mut r);
                let (out, outcome, _) = run(&input, &opt);
                match outcome {
                    Outcome::Sorted => {
                        assert!(out.windows(2).all(|w| w[0].key <= w[1].key));
                        let mut a = out.clone();
                        let mut b = input.clone();
                        a.sort_by_key(|x| (x.key, x.tag));
                        b.sort_by_key(|x| (x.key, x.tag));
                        assert_eq!(a, b);
                    }
                    Outcome::Truncated | Outcome::NotASort(_) => {}
                    o => panic!("unexpected outcome {o:?}"),
                }
            }
        }
    }

    #[test]
    fn step_limit_stops_the_run() {
        let input = keyed((0..40).rev());
        let opt = Options {
            max_steps: 200,
            ..Options::default()
        };
        let (_, outcome, t) = run(&input, &opt);
        assert_ne!(
            outcome,
            Outcome::Sorted,
            "40 reversed keys cannot finish in 200 steps"
        );
        assert!(t.steps().len() <= 200);
    }

    #[test]
    fn sorts_tiny_and_gives_up_on_large() {
        let (out, o, _) = run(&keyed([2, 1, 0]), &count_only());
        assert_eq!(o, Outcome::Sorted);
        assert!(out.windows(2).all(|w| w[0].key <= w[1].key));
        let (_, o, _) = run(&keyed((0..12).rev()), &count_only());
        assert_eq!(o, Outcome::Truncated);
    }
}
