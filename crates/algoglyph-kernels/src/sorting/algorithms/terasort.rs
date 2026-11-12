//! TeraSort (O'Malley 2008, "TeraByte Sort on Apache Hadoop", Yahoo! technical report,
//! http://sortbenchmark.org/YahooHadoop.pdf; the Hadoop `org.apache.hadoop.examples.terasort`
//! package).
//!
//! The documented MapReduce pipeline, simulated with M mappers and R reducers (both =
//! `options.k` when it is at least 2, otherwise 4), one lane each (`t.lane(i)`):
//! 1. sample: the input sampler reads a sample of keys from the input splits (10 per
//!    reducer here), sorts it and picks R - 1 split points, so every reducer receives a
//!    key range of about equal size (this is what makes the concatenated output totally
//!    ordered);
//! 2. map: every mapper reads its split and assigns each record to the reducer of its key
//!    range (TeraSort uses a two-level trie over key prefixes; here a binary search over
//!    the split points);
//! 3. sort/spill: every mapper sorts its output by (partition, key), as Hadoop's map side
//!    does;
//! 4. shuffle: reducer r fetches partition r from every mapper (`aux`);
//! 5. merge/reduce: every reducer merges its M sorted segments; the reduce function is the
//!    identity;
//! 6. output: the reducers' files, in reducer order, are the sorted result.
//! Simplification: the trie partitioner is replaced by binary search over the same split
//! points. Map-side sorts are stable merges and the reduce merge takes the lower mapper on
//! ties, so this simulation happens to be stable; Hadoop does not promise that, and META
//! declares it unstable.
//!
//! Rounds (`t.round()`): one per stage that every task runs: map, sort/spill, merge/reduce.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "terasort",
    stable: Stability::No,
    in_place: false,
    kind: Kind::Comparison,
};

const SAMPLE_PER_REDUCER: usize = 10;

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
    let (mappers, reducers) = (p, p);
    t.phase("sample: read sample keys, sort them, pick the split points");
    let mut sample: Vec<Item> = (0..SAMPLE_PER_REDUCER * reducers)
        .map(|_| {
            let i = t.rng().range(0, n);
            t.read(v, i)
        })
        .collect();
    merge_sort(t, &mut sample);
    let cuts: Vec<Item> = (1..reducers)
        .map(|r| sample[r * sample.len() / reducers])
        .collect();
    t.aux("split points", &cuts);

    t.round();
    t.phase("map: assign every record to the reducer of its key range");
    let split = n.div_ceil(mappers);
    // spill[m][r] = output of mapper m for reducer r
    let mut spill: Vec<Vec<Vec<Item>>> = vec![vec![Vec::new(); reducers]; mappers];
    for (m, out) in spill.iter_mut().enumerate() {
        t.lane(m as u32);
        for i in (m * split).min(n)..((m + 1) * split).min(n) {
            let x = t.read(v, i);
            let r = partition(t, &cuts, &x);
            out[r].push(x);
        }
    }
    t.aux_clear("split points");
    t.round();
    t.phase("sort/spill: every mapper sorts its output by (partition, key)");
    for (m, out) in spill.iter_mut().enumerate() {
        t.lane(m as u32);
        for seg in out.iter_mut() {
            merge_sort(t, seg);
        }
    }
    if !t.ok() {
        return Outcome::Truncated;
    }
    t.phase("shuffle: reducer r fetches partition r from every mapper");
    let mut fetched: Vec<Vec<Vec<Item>>> = vec![Vec::with_capacity(mappers); reducers];
    for out in spill {
        for (r, seg) in out.into_iter().enumerate() {
            fetched[r].push(seg);
        }
    }
    t.round();
    t.phase("merge/reduce: every reducer merges its sorted segments (identity reduce)");
    let mut pos = 0;
    for (r, segs) in fetched.iter().enumerate() {
        t.lane(r as u32);
        let part = kway_merge(t, segs);
        t.aux(&format!("reducer {r} output"), &part);
        for x in &part {
            t.set(v, pos, *x);
            pos += 1;
        }
        t.aux_clear(&format!("reducer {r} output"));
        if !t.ok() {
            return Outcome::Truncated;
        }
    }
    Outcome::Sorted
}

/// Reducer of `x`: the number of split points <= x.
fn partition(t: &mut Tracer, cuts: &[Item], x: &Item) -> usize {
    let (mut lo, mut hi) = (0usize, cuts.len());
    while lo < hi {
        let mid = lo + (hi - lo) / 2;
        if t.cmp_items(x, &cuts[mid]) == Ordering::Less {
            hi = mid;
        } else {
            lo = mid + 1;
        }
    }
    lo
}

/// Stable in-memory merge sort of a segment.
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

/// Stable k-way merge of sorted runs (ties go to the lower run), selecting the smallest
/// head by a scan of the k heads.
fn kway_merge(t: &mut Tracer, runs: &[Vec<Item>]) -> Vec<Item> {
    let mut idx = vec![0usize; runs.len()];
    let total: usize = runs.iter().map(|r| r.len()).sum();
    let mut out = Vec::with_capacity(total);
    while out.len() < total {
        let mut best: Option<usize> = None;
        for (r, run) in runs.iter().enumerate() {
            if idx[r] >= run.len() {
                continue;
            }
            best = match best {
                None => Some(r),
                Some(b) if t.cmp_items(&run[idx[r]], &runs[b][idx[b]]) == Ordering::Less => Some(r),
                keep => keep,
            };
        }
        let b = best.expect("a run with items left");
        out.push(runs[b][idx[b]]);
        idx[b] += 1;
    }
    out
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
