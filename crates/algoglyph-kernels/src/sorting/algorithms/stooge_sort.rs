//! Stooge sort (Cormen, Leiserson, Rivest and Stein, "Introduction to Algorithms", problem
//! 7-3 "Stooge sort", attributed there to Howard, Fine and Howard).
//!
//! If the first element is greater than the last, swap them; then, for three or more
//! elements, stooge-sort the first two thirds, the last two thirds and the first two
//! thirds again (the thirds rounded so that the overlap is at least a third). Correct, and
//! O(n^(log 3 / log 1.5)) = O(n^2.71) comparisons, so it is meant for small n only; the run
//! stops with `Outcome::Truncated` at the step limit. No simplification.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "stooge-sort",
    stable: Stability::No,
    in_place: true,
    kind: Kind::Joke,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if n < 2 {
        return Outcome::Sorted;
    }
    if stooge(t, v, 0, n - 1) {
        Outcome::Sorted
    } else {
        Outcome::Truncated
    }
}

fn stooge(t: &mut Tracer, v: &mut [Item], i: usize, j: usize) -> bool {
    if !t.ok() {
        return false;
    }
    if t.cmp(v, i, j) == Ordering::Greater {
        t.swap(v, i, j);
    }
    if j - i + 1 >= 3 {
        let third = (j - i + 1) / 3;
        t.mark(i, j + 1, "stooge");
        return stooge(t, v, i, j - third)
            && stooge(t, v, i + third, j)
            && stooge(t, v, i, j - third);
    }
    true
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
    fn sorts_up_to_sixty() {
        let mut r = SplitMix64::new(1);
        for n in [0usize, 1, 2, 3, 10, 27, 60] {
            let input = random(n, -9, 9, &mut r);
            let (out, o, _) = run(&input, &count_only());
            assert_eq!(o, Outcome::Sorted);
            let mut want: Vec<i32> = input.iter().map(|x| x.key).collect();
            want.sort();
            assert_eq!(out.iter().map(|x| x.key).collect::<Vec<_>>(), want);
        }
    }
}
