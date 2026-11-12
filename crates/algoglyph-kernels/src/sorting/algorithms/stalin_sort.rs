//! Stalin sort (internet folklore, popularised on social media around 2018; no formal
//! publication).
//!
//! Go through the list once and eliminate every element that is out of order, i.e. smaller
//! than the last element kept. The survivors are sorted, in O(n) comparisons, but they are
//! in general not a permutation of the input: the run returns
//! `Outcome::NotASort("drops out-of-order elements")` with the kept sequence as the output.
//! An input that is already sorted loses nothing and is reported as sorted. The kept
//! elements are compacted to the front with `set`, then the array is truncated.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "stalin-sort",
    stable: Stability::Yes,
    in_place: true,
    kind: Kind::Joke,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if n < 2 {
        return Outcome::Sorted;
    }
    t.phase("keep each element that is not smaller than the last one kept");
    let mut kept = 1usize;
    for i in 1..n {
        if t.cmp(v, i, kept - 1) != Ordering::Less {
            if i != kept {
                let x = t.read(v, i);
                t.set(v, kept, x);
            }
            kept += 1;
        } else {
            t.mark(i, i + 1, "eliminated");
        }
    }
    if kept == n {
        return Outcome::Sorted;
    }
    t.phase(&format!("{} of {n} elements eliminated", n - kept));
    v.truncate(kept);
    Outcome::NotASort("drops out-of-order elements")
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
    fn keeps_the_non_decreasing_subsequence() {
        let (out, o, _) = run(&keyed([1, 3, 2, 3, 0, 5]), &count_only());
        assert_eq!(o, Outcome::NotASort("drops out-of-order elements"));
        assert_eq!(
            out.iter().map(|x| x.key).collect::<Vec<_>>(),
            vec![1, 3, 3, 5]
        );
        assert_eq!(
            out.iter().map(|x| x.tag).collect::<Vec<_>>(),
            vec![0, 1, 3, 5]
        );
        let (out, o, _) = run(&keyed([1, 1, 4]), &count_only());
        assert_eq!(o, Outcome::Sorted);
        assert_eq!(out.len(), 3);
    }
}
