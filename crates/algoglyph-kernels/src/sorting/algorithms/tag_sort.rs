//! Tag sort, also key sorting or address-table sorting (Knuth, TAOCP Vol. 3, 2nd ed.,
//! section 5.1 and 5.2, on sorting a table of pointers and rearranging the records
//! afterwards, exercises 5.2-10 to 5.2-12).
//!
//! When records are large, moving them during the sort is the expensive part. A tag sort
//! therefore sorts a separate array of tags (record addresses) by comparing the records'
//! keys through the tags, and leaves the records where they are; only at the end are the
//! records rearranged into the order of the tags, in place, by following the cycles of the
//! permutation, which moves every record at most once (n + number of cycles moves). It is
//! partly a thought experiment about cost models: the comparisons are the same as those of
//! the sort used on the tags, but data movement drops to O(n).
//!
//! The simulation: phase 1 builds the tag array (`aux`), phase 2 sorts it with a stable
//! merge sort whose comparisons read the records' keys in place (`cmp` highlights the two
//! record positions), phase 3 rearranges the records by cycle leaders with one held record
//! per cycle. Stable because the tag sort is. No simplification.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "tag-sort",
    stable: Stability::Variant,
    in_place: false,
    kind: Kind::Comparison,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    t.phase("phase 1: one tag (record address) per record");
    let mut tags: Vec<usize> = (0..n).collect();
    show(t, v, &tags);
    t.phase("phase 2: sort the tags by the keys they point to; records stay put");
    sort_tags(t, v, &mut tags);
    show(t, v, &tags);
    if !t.ok() {
        return Outcome::Truncated;
    }
    t.phase("phase 3: rearrange the records by following the cycles of the tags");
    // position i must receive record tags[i]
    let mut done = vec![false; n];
    for start in 0..n {
        if done[start] || tags[start] == start {
            done[start] = true;
            continue;
        }
        let held = t.read(v, start);
        let mut i = start;
        loop {
            done[i] = true;
            let src = tags[i];
            if src == start {
                t.set(v, i, held);
                break;
            }
            let x = v[src];
            t.set(v, i, x);
            i = src;
        }
    }
    t.aux_clear("tags");
    Outcome::Sorted
}

fn show(t: &mut Tracer, v: &[Item], tags: &[usize]) {
    let view: Vec<Item> = tags.iter().map(|&i| v[i]).collect();
    t.aux("tags", &view);
}

/// Stable merge sort of the tags; comparisons go to the records.
fn sort_tags(t: &mut Tracer, v: &[Item], tags: &mut [usize]) {
    let n = tags.len();
    if n < 2 {
        return;
    }
    let mid = n / 2;
    sort_tags(t, v, &mut tags[..mid]);
    sort_tags(t, v, &mut tags[mid..]);
    let left = tags[..mid].to_vec();
    let (mut i, mut j, mut k) = (0, mid, 0);
    while i < left.len() && j < n {
        if t.cmp(v, tags[j], left[i]) == Ordering::Less {
            tags[k] = tags[j];
            j += 1;
        } else {
            tags[k] = left[i];
            i += 1;
        }
        k += 1;
    }
    while i < left.len() {
        tags[k] = left[i];
        i += 1;
        k += 1;
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
}
