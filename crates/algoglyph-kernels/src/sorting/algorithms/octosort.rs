//! Octosort (Igor van den Hoven, official repository https://github.com/scandum/octosort).
//!
//! The documented strategy: a stable, adaptive, bottom-up block merge sort that needs only
//! O(1) memory, derived from quadsort. Runs are merged with a small fixed swap buffer: when
//! the shorter of two runs fits the buffer it is copied there and merged back (forward when
//! it is the left run, backward when it is the right run); when neither fits, the merge
//! splits the problem with a binary search and a rotation until the pieces fit. Adjacent
//! runs that are already in order are not merged at all, which makes sorted and nearly
//! sorted input cheap.
//!
//! Simplifications: the buffer holds 32 elements; the initial runs of 32 elements are
//! built by a stable binary insertion sort instead of quadsort's quad swaps; the rotation
//! merge splits at the midpoint of the longer run (a symmetric rotate merge) instead of
//! the repository's monobound searches over blocks.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "octosort",
    stable: Stability::Yes,
    in_place: true,
    kind: Kind::Comparison,
};

const BUF: usize = 32;

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    t.phase("build runs of 32 by binary insertion");
    let mut lo = 0;
    while lo < n {
        if !t.ok() {
            return Outcome::Truncated;
        }
        let hi = (lo + BUF).min(n);
        binary_insertion(t, v, lo, hi);
        lo = hi;
    }
    let mut buf: Vec<Item> = Vec::with_capacity(BUF);
    let mut width = BUF;
    while width < n {
        t.phase(&format!("merge runs of {width}"));
        let mut lo = 0;
        while lo + width < n {
            if !t.ok() {
                return Outcome::Truncated;
            }
            let mid = lo + width;
            let hi = (lo + 2 * width).min(n);
            merge(t, v, lo, mid, hi, &mut buf);
            lo = hi;
        }
        width *= 2;
    }
    if t.ok() {
        Outcome::Sorted
    } else {
        Outcome::Truncated
    }
}

fn merge(t: &mut Tracer, v: &mut [Item], lo: usize, mid: usize, hi: usize, buf: &mut Vec<Item>) {
    if lo == mid || mid == hi || t.cmp(v, mid - 1, mid) != Ordering::Greater {
        return; // empty side or already in order
    }
    if mid - lo <= BUF {
        forward_merge(t, v, lo, mid, hi, buf);
        return;
    }
    if hi - mid <= BUF {
        backward_merge(t, v, lo, mid, hi, buf);
        return;
    }
    t.mark(lo, hi, "rotate merge");
    if mid - lo >= hi - mid {
        let m1 = lo + (mid - lo) / 2;
        let key = v[m1];
        let j = lower_bound(t, v, mid, hi, &key);
        rotate(t, v, m1, mid, j);
        let k = m1 + (j - mid); // key's new position
        merge(t, v, lo, m1, k, buf);
        merge(t, v, k + 1, k + (mid - m1), hi, buf);
    } else {
        let m2 = mid + (hi - mid) / 2;
        let key = v[m2];
        let i = upper_bound(t, v, lo, mid, &key);
        rotate(t, v, i, mid, m2 + 1);
        let k = i + (m2 - mid); // key's new position
        merge(t, v, lo, i, k, buf);
        merge(t, v, k + 1, k + 1 + (mid - i), hi, buf);
    }
}

fn forward_merge(
    t: &mut Tracer,
    v: &mut [Item],
    lo: usize,
    mid: usize,
    hi: usize,
    buf: &mut Vec<Item>,
) {
    buf.clear();
    for i in lo..mid {
        buf.push(t.read(v, i));
    }
    t.aux("swap", buf);
    let (mut i, mut j, mut out) = (0usize, mid, lo);
    while i < buf.len() && j < hi {
        if t.cmp_items(&v[j], &buf[i]) == Ordering::Less {
            let x = v[j];
            t.set(v, out, x);
            j += 1;
        } else {
            t.set(v, out, buf[i]);
            i += 1;
        }
        out += 1;
    }
    while i < buf.len() {
        t.set(v, out, buf[i]);
        i += 1;
        out += 1;
    }
}

fn backward_merge(
    t: &mut Tracer,
    v: &mut [Item],
    lo: usize,
    mid: usize,
    hi: usize,
    buf: &mut Vec<Item>,
) {
    buf.clear();
    for i in mid..hi {
        buf.push(t.read(v, i));
    }
    t.aux("swap", buf);
    let (mut i, mut j, mut out) = (mid, buf.len(), hi);
    while i > lo && j > 0 {
        out -= 1;
        if t.cmp_items(&v[i - 1], &buf[j - 1]) == Ordering::Greater {
            let x = v[i - 1];
            t.set(v, out, x);
            i -= 1;
        } else {
            t.set(v, out, buf[j - 1]);
            j -= 1;
        }
    }
    while j > 0 {
        out -= 1;
        t.set(v, out, buf[j - 1]);
        j -= 1;
    }
}

/// First index in [lo, hi) whose key is >= key.
fn lower_bound(t: &mut Tracer, v: &[Item], mut lo: usize, mut hi: usize, key: &Item) -> usize {
    while lo < hi {
        let mid = lo + (hi - lo) / 2;
        if t.cmp_items(&v[mid], key) == Ordering::Less {
            lo = mid + 1;
        } else {
            hi = mid;
        }
    }
    lo
}

/// First index in [lo, hi) whose key is > key.
fn upper_bound(t: &mut Tracer, v: &[Item], mut lo: usize, mut hi: usize, key: &Item) -> usize {
    while lo < hi {
        let mid = lo + (hi - lo) / 2;
        if t.cmp_items(&v[mid], key) == Ordering::Greater {
            hi = mid;
        } else {
            lo = mid + 1;
        }
    }
    lo
}

fn rotate(t: &mut Tracer, v: &mut [Item], first: usize, middle: usize, last: usize) {
    if first == middle || middle == last {
        return;
    }
    reverse(t, v, first, middle);
    reverse(t, v, middle, last);
    reverse(t, v, first, last);
}

fn reverse(t: &mut Tracer, v: &mut [Item], mut i: usize, mut j: usize) {
    while i + 1 < j {
        j -= 1;
        t.swap(v, i, j);
        i += 1;
    }
}

fn binary_insertion(t: &mut Tracer, v: &mut [Item], lo: usize, hi: usize) {
    for i in lo + 1..hi {
        let x = t.read(v, i);
        let (mut a, mut b) = (lo, i);
        while a < b {
            let mid = a + (b - a) / 2;
            if t.cmp_items(&x, &v[mid]) == Ordering::Less {
                b = mid;
            } else {
                a = mid + 1;
            }
        }
        let mut j = i;
        while j > a {
            let y = v[j - 1];
            t.set(v, j, y);
            j -= 1;
        }
        if a != i {
            t.set(v, a, x);
        }
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
