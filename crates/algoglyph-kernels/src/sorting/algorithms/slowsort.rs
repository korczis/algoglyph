//! Slowsort (Broder and Stolfi 1984, "Pessimal algorithms and simplexity analysis", ACM
//! SIGACT News 16(3), 49-53).
//!
//! The "multiply and surrender" paradigm: to sort A[i..j], find the maximum by slowsorting
//! both halves and keeping the larger of the two last elements at the end, then slowsort
//! everything except that maximum. Correct, with a running time that is not even polynomial
//! (T(n) = 2T(n/2) + T(n - 1) + 1), so it is meant for small n only; the run stops with
//! `Outcome::Truncated` at the step limit. No simplification.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "slowsort",
    stable: Stability::No,
    in_place: true,
    kind: Kind::Joke,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if n < 2 {
        return Outcome::Sorted;
    }
    if slow(t, v, 0, n - 1) {
        Outcome::Sorted
    } else {
        Outcome::Truncated
    }
}

fn slow(t: &mut Tracer, v: &mut [Item], i: usize, j: usize) -> bool {
    if i >= j {
        return true;
    }
    if !t.ok() {
        return false;
    }
    let m = i + (j - i) / 2;
    if !slow(t, v, i, m) || !slow(t, v, m + 1, j) {
        return false;
    }
    if t.cmp(v, j, m) == Ordering::Less {
        t.swap(v, j, m);
    }
    slow(t, v, i, j - 1)
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
    fn sorts_up_to_twenty_four() {
        let mut r = SplitMix64::new(2);
        for n in [0usize, 1, 2, 3, 10, 24] {
            let input = random(n, -9, 9, &mut r);
            let (out, o, _) = run(&input, &count_only());
            assert_eq!(o, Outcome::Sorted);
            let mut want: Vec<i32> = input.iter().map(|x| x.key).collect();
            want.sort();
            assert_eq!(out.iter().map(|x| x.key).collect::<Vec<_>>(), want);
        }
    }
}
