//! External samplesort, i.e. distribution sort with sampled splitters (Aggarwal and
//! Vitter 1988, "The input/output complexity of sorting and related problems",
//! Communications of the ACM 31(9), 1116-1127; Vitter 2008, "Algorithms and Data
//! Structures for External Memory", Foundations and Trends in TCS 2(4), section 5.1).
//!
//! A part of the file that fits in memory (M = ceil(sqrt n), at least 4) is sorted there.
//! A larger part is sampled (3 random items per bucket), the sample is sorted in memory and
//! k - 1 splitters are taken from it (k = `options.k` when it is at least 2, otherwise 4);
//! one sequential pass then distributes the part into k bucket files (`aux`) by binary
//! search among the splitters, the bucket files are written back over the part in order,
//! and every bucket is sorted recursively. Items equal to a splitter go to a bucket of
//! their own that needs no further work, which guarantees progress with many equal keys.
//! Simplification: one pass distributes into all k buckets at once, without the per-bucket
//! output blocks of the I/O model (`external-radix-sort` shows those).
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "external-samplesort",
    stable: Stability::No,
    in_place: false,
    kind: Kind::External,
};

const OVERSAMPLE: usize = 3;

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, opt: &Options) -> Outcome {
    let n = v.len();
    let m = memory_size(n);
    let k = ways(opt, 4);
    if dist(t, v, 0, n, m, k, 0) {
        Outcome::Sorted
    } else {
        Outcome::Truncated
    }
}

fn dist(
    t: &mut Tracer,
    v: &mut [Item],
    lo: usize,
    hi: usize,
    m: usize,
    k: usize,
    depth: usize,
) -> bool {
    if !t.ok() {
        return false;
    }
    let n = hi - lo;
    if n < 2 {
        return true;
    }
    if n <= m {
        t.phase(&format!(
            "depth {depth}: the part fits in memory, internal sort"
        ));
        let mut load: Vec<Item> = (lo..hi).map(|i| t.read(v, i)).collect();
        t.aux("memory", &load);
        mem_sort(t, &mut load);
        for (j, x) in load.into_iter().enumerate() {
            t.set(v, lo + j, x);
        }
        t.aux_clear("memory");
        return true;
    }
    t.phase(&format!(
        "depth {depth}: sample and choose {} splitters",
        k - 1
    ));
    let mut sample: Vec<Item> = (0..OVERSAMPLE * k)
        .map(|_| {
            let i = lo + t.rng().range(0, n);
            t.read(v, i)
        })
        .collect();
    mem_sort(t, &mut sample);
    let splitters: Vec<Item> = (1..k).map(|i| sample[i * OVERSAMPLE - 1]).collect();
    t.aux("splitters", &splitters);
    t.phase(&format!("depth {depth}: distribute into bucket files"));
    let mut files: Vec<Vec<Item>> = vec![Vec::new(); 2 * k - 1];
    for i in lo..hi {
        let x = t.read(v, i);
        let b = classify(t, &splitters, &x);
        files[b].push(x);
    }
    t.aux_clear("splitters");
    let mut pos = lo;
    let mut parts = Vec::new();
    for (b, f) in files.iter().enumerate() {
        if f.is_empty() {
            continue;
        }
        t.aux(&format!("bucket file {b}"), f);
        let start = pos;
        for x in f {
            t.set(v, pos, *x);
            pos += 1;
        }
        t.aux_clear(&format!("bucket file {b}"));
        if b % 2 == 0 {
            parts.push((start, pos));
        }
    }
    for (a, b) in parts {
        if !dist(t, v, a, b, m, k, depth + 1) {
            return false;
        }
    }
    true
}

/// 2b for keys between splitters b-1 and b, 2b+1 for keys equal to splitter b.
fn classify(t: &mut Tracer, s: &[Item], x: &Item) -> usize {
    let (mut lo, mut hi) = (0usize, s.len());
    while lo < hi {
        let mid = lo + (hi - lo) / 2;
        if t.cmp_items(&s[mid], x) == Ordering::Less {
            lo = mid + 1;
        } else {
            hi = mid;
        }
    }
    if lo < s.len() && t.cmp_items(x, &s[lo]) != Ordering::Less {
        2 * lo + 1
    } else {
        2 * lo
    }
}

/// Memory size M of the simulation: ceil(sqrt n), at least 4 items.
fn memory_size(n: usize) -> usize {
    let mut m = 4;
    while m * m < n {
        m += 1;
    }
    m
}

/// Fan-in / number of ways: `options.k` when it is at least 2, otherwise `default`.
fn ways(opt: &Options, default: usize) -> usize {
    if opt.k >= 2 {
        (opt.k as usize).min(64)
    } else {
        default
    }
}

/// Stable in-memory merge sort of one memory load.
fn mem_sort(t: &mut Tracer, a: &mut [Item]) {
    let n = a.len();
    if n < 2 {
        return;
    }
    let mid = n / 2;
    mem_sort(t, &mut a[..mid]);
    mem_sort(t, &mut a[mid..]);
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
