//! Miracle sort (internet folklore; no formal publication).
//!
//! Check whether the array is sorted. If it is not, wait for a miracle (cosmic rays
//! flipping exactly the right bits, say) and check again, forever. The simulation checks
//! once: an already sorted input is reported as sorted; any other input returns
//! `Outcome::NotASort("waits for a miracle")` with the array untouched, because no finite
//! simulation can honestly produce the miracle.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "miracle-sort",
    stable: Stability::Yes,
    in_place: true,
    kind: Kind::Joke,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    t.phase("check whether a miracle has already happened");
    if (1..v.len()).all(|i| t.cmp(v, i - 1, i) != Ordering::Greater) {
        return Outcome::Sorted;
    }
    t.phase("not sorted: waiting for a miracle");
    Outcome::NotASort("waits for a miracle")
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
    fn sorted_input_passes_unsorted_waits() {
        let (_, o, _) = run(&keyed([1, 2, 2, 5]), &count_only());
        assert_eq!(o, Outcome::Sorted);
        let input = keyed([3, 1, 2]);
        let (out, o, _) = run(&input, &count_only());
        assert_eq!(o, Outcome::NotASort("waits for a miracle"));
        assert_eq!(out, input);
    }
}
