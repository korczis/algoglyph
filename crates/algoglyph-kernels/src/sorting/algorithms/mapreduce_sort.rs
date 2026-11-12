//! MapReduce sort (Dean and Ghemawat 2004, "MapReduce: Simplified Data Processing on
//! Large Clusters", OSDI 2004, 137-150, section 5.3 "Sort").
//!
//! The sort program of the MapReduce paper, simulated with M map tasks and R reduce tasks
//! (both = `options.k` when it is at least 2, otherwise 4), one lane each (`t.lane(i)`):
//! 1. map: every map task reads its input split and emits (key, record) pairs, assigning
//!    each to a reduce partition. A hash partitioner would scatter the keys; the sort
//!    program instead uses a partitioning function "with built-in knowledge of the
//!    distribution of keys", so partition r receives the r-th key range. Here the ranges
//!    are equal intervals of [min, max] (found by one pass over the input);
//! 2. shuffle: reduce task r fetches partition r from every map task (`aux`);
//! 3. sort: the framework sorts every reduce task's intermediate pairs by key (the
//!    ordering guarantee of section 4.2), here with a merge sort;
//! 4. reduce: the identity function; the R output files, in order, are the sorted result.
//! The equal-interval partitioner is the documented simplification (the paper does not
//! give its exact function); unlike TeraSort there is no sampling, so skewed keys give
//! unequal partitions. The framework sort is a stable merge sort here, so this simulation
//! happens to be stable; META declares it unstable, as nothing in the paper promises it.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "mapreduce-sort",
    stable: Stability::No,
    in_place: false,
    kind: Kind::Comparison,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, opt: &Options) -> Outcome {
    let n = v.len();
    if n < 2 {
        return Outcome::Sorted;
    }
    let p = if opt.k >= 2 {
        (opt.k as usize).min(64)
    } else {
        4
    };
    let (maps, reduces) = (p, p);
    t.phase("find the key range for the range partitioner");
    let (mut min, mut max) = (i64::MAX, i64::MIN);
    for i in 0..n {
        let k = t.read(v, i).key as i64;
        min = min.min(k);
        max = max.max(k);
    }
    let span = (max - min) as u128 + 1;
    let part = |x: &Item| (((x.key as i64 - min) as u128 * reduces as u128) / span) as usize;
    t.phase("map: emit every record to its key-range partition");
    let split = n.div_ceil(maps);
    let mut emitted: Vec<Vec<Vec<Item>>> = vec![vec![Vec::new(); reduces]; maps];
    for (m, out) in emitted.iter_mut().enumerate() {
        t.lane(m as u32);
        for i in (m * split).min(n)..((m + 1) * split).min(n) {
            let x = t.read(v, i);
            out[part(&x)].push(x);
        }
    }
    t.phase("shuffle: reduce task r fetches partition r from every map task");
    let mut inbox: Vec<Vec<Item>> = vec![Vec::new(); reduces];
    for out in emitted {
        for (r, seg) in out.into_iter().enumerate() {
            inbox[r].extend(seg);
        }
    }
    for (r, b) in inbox.iter().enumerate() {
        t.lane(r as u32);
        t.aux(&format!("reduce task {r}"), b);
    }
    t.phase("sort: the framework sorts every reduce task's pairs by key; reduce = identity");
    let mut pos = 0;
    for (r, b) in inbox.iter_mut().enumerate() {
        t.lane(r as u32);
        merge_sort(t, b);
        for x in b.iter() {
            t.set(v, pos, *x);
            pos += 1;
        }
        t.aux_clear(&format!("reduce task {r}"));
        if !t.ok() {
            return Outcome::Truncated;
        }
    }
    Outcome::Sorted
}

/// Stable in-memory merge sort of a reduce task.
fn merge_sort(t: &mut Tracer, a: &mut [Item]) {
    let n = a.len();
    if n < 2 {
        return;
    }
    let mid = n / 2;
    merge_sort(t, &mut a[..mid]);
    merge_sort(t, &mut a[mid..]);
    if t.cmp_items(&a[mid - 1], &a[mid]) != Ordering::Greater {
        return;
    }
    let left = a[..mid].to_vec();
    let (mut i, mut j, mut k) = (0, mid, 0);
    while i < left.len() && j < n {
        if t.cmp_items(&a[j], &left[i]) == Ordering::Less {
            a[k] = a[j];
            j += 1;
        } else {
            a[k] = left[i];
            i += 1;
        }
        k += 1;
    }
    while i < left.len() {
        a[k] = left[i];
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
