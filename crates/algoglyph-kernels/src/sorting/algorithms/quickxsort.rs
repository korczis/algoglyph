//! QuickXsort with X = Mergesort, i.e. QuickMergesort (Edelkamp and Weiss 2014,
//! "QuickXsort: Efficient Sorting with n log n - 1.399n + o(n) Comparisons on Average",
//! CSR 2014, arXiv:1307.3033; Edelkamp, Weiss and Wild 2019, "QuickXsort: A Fast Sorting
//! Scheme in Theory and Practice", Algorithmica, arXiv:1811.01259).
//!
//! The documented strategy: partition around a pivot like Quicksort, then sort one of the
//! two segments with X while the other segment serves as X's working buffer, and continue
//! with the buffer segment. Mergesort merges by swapping, so the buffer's elements are only
//! permuted, never lost. The segment given to Mergesort must be at most twice the size of
//! the buffer: the larger segment when that holds, otherwise the smaller one.
//!
//! Simplifications: the pivot is the median of three (the papers use a sqrt(n) sample for
//! the comparison bound), and segments of at most 16 elements are finished by insertion
//! sort.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "quickxsort",
    stable: Stability::No,
    in_place: true,
    kind: Kind::Comparison,
};

const SMALL: usize = 16;

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let (mut lo, mut hi) = (0usize, v.len());
    while hi - lo > SMALL {
        if !t.ok() {
            return Outcome::Truncated;
        }
        t.phase("quicksort partition");
        let p = partition(t, v, lo, hi);
        let (left, right) = ((lo, p), (p + 1, hi));
        let (big, small) = if p - lo >= hi - p - 1 {
            (left, right)
        } else {
            (right, left)
        };
        let (big_len, small_len) = (big.1 - big.0, small.1 - small.0);
        if small_len >= big_len / 2 {
            t.phase("mergesort the larger segment, the smaller is the buffer");
            t.mark(small.0, small.1, "buffer");
            msort(t, v, big.0, big.1, small.0);
            lo = small.0;
            hi = small.1;
        } else {
            t.phase("mergesort the smaller segment, the larger is the buffer");
            t.mark(big.0, big.1, "buffer");
            msort(t, v, small.0, small.1, big.0);
            lo = big.0;
            hi = big.1;
        }
    }
    t.phase("insertion sort of the last segment");
    for i in lo + 1..hi {
        let mut j = i;
        while j > lo && t.cmp(v, j - 1, j) == Ordering::Greater {
            t.swap(v, j - 1, j);
            j -= 1;
        }
    }
    if t.ok() {
        Outcome::Sorted
    } else {
        Outcome::Truncated
    }
}

/// Hoare-style partition (Sedgewick's form) around the median of three, which is moved
/// to `lo` first; returns the pivot's final index. Keys equal to the pivot stop both
/// scans, so runs of equal keys split evenly.
fn partition(t: &mut Tracer, v: &mut [Item], lo: usize, hi: usize) -> usize {
    let mid = lo + (hi - lo) / 2;
    let last = hi - 1;
    if t.cmp(v, mid, lo) == Ordering::Less {
        t.swap(v, mid, lo);
    }
    if t.cmp(v, last, lo) == Ordering::Less {
        t.swap(v, last, lo);
    }
    if t.cmp(v, last, mid) == Ordering::Less {
        t.swap(v, last, mid);
    }
    // v[lo] <= v[mid] <= v[last]: bring the median to lo.
    t.swap(v, lo, mid);
    let (mut i, mut j) = (lo, hi);
    loop {
        i += 1;
        while i < last && t.cmp(v, i, lo) == Ordering::Less {
            i += 1;
        }
        j -= 1;
        while j > lo && t.cmp(v, lo, j) == Ordering::Less {
            j -= 1;
        }
        if i >= j {
            break;
        }
        t.swap(v, i, j);
    }
    t.swap(v, lo, j);
    j
}

/// Mergesort of [lo, hi) using the disjoint buffer starting at `buf` (at least
/// (hi - lo) / 2 elements long). Every move is a swap, so the buffer is only permuted.
fn msort(t: &mut Tracer, v: &mut [Item], lo: usize, hi: usize, buf: usize) {
    let n = hi - lo;
    if n < 2 || !t.ok() {
        return;
    }
    let m = n / 2;
    msort(t, v, lo, lo + m, buf);
    msort(t, v, lo + m, hi, buf);
    // Move the left run into the buffer, then merge buffer + right run into [lo, hi).
    for k in 0..m {
        t.swap(v, lo + k, buf + k);
    }
    let (mut i, mut j, mut out) = (buf, lo + m, lo);
    while i < buf + m && j < hi {
        if t.cmp(v, j, i) == Ordering::Less {
            t.swap(v, out, j);
            j += 1;
        } else {
            t.swap(v, out, i);
            i += 1;
        }
        out += 1;
    }
    while i < buf + m {
        t.swap(v, out, i);
        i += 1;
        out += 1;
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

    #[test]
    fn in_place_aux_stays_small() {
        let mut r = SplitMix64::new(5);
        let mut peak = |n: usize| {
            let (_, _, t) = run(&random(n, -5000, 5000, &mut r), &count_only());
            t.counts().aux
        };
        let (p1, p2) = (peak(256), peak(2048));
        assert!(
            p2 <= p1 + 64 && p2 <= 512 + 16 * 11,
            "aux peak {p1} -> {p2}"
        );
    }
}
