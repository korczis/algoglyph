//! Bozosort (analysed in Gruber, Holzer and Ruepp 2007, "Sorting the Slow Way: An Analysis
//! of Perversely Awful Randomized Sorting Algorithms", FUN 2007, LNCS 4475, 183-197).
//!
//! Check whether the array is sorted; if not, swap two positions chosen at random and check
//! again. Like bogosort its expected running time is about n! checks for distinct keys, so
//! the run is bounded: after 100 000 random swaps, or when the step limit is reached, it
//! stops with `Outcome::Truncated`.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "bozosort",
    stable: Stability::No,
    in_place: true,
    kind: Kind::Joke,
};

const MAX_ATTEMPTS: u32 = 100_000;

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    for _ in 0..MAX_ATTEMPTS {
        if !t.ok() {
            return Outcome::Truncated;
        }
        if (1..n).all(|i| t.cmp(v, i - 1, i) != Ordering::Greater) {
            return Outcome::Sorted;
        }
        let i = t.rng().range(0, n);
        let j = t.rng().range(0, n);
        t.swap(v, i, j);
    }
    if (1..n).all(|i| t.cmp(v, i - 1, i) != Ordering::Greater) {
        return Outcome::Sorted;
    }
    t.phase("gave up after 100 000 random swaps");
    Outcome::Truncated
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
        let (out, o, _) = run(&keyed([3, 1, 2, 0]), &count_only());
        assert_eq!(o, Outcome::Sorted);
        assert!(out.windows(2).all(|w| w[0].key <= w[1].key));
        let (_, o, _) = run(&keyed((0..30).rev()), &count_only());
        assert_eq!(o, Outcome::Truncated);
    }
}
