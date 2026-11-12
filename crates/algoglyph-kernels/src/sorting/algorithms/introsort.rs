//! Introsort (Musser 1997, "Introspective Sorting and Selection Algorithms", Software:
//! Practice and Experience 27(8), 983-993).
//!
//! The documented strategy: median-of-3 quicksort with an unguarded Hoare partition and a
//! recursion depth limit of 2 * floor(log2 n). A partition that reaches the limit is
//! finished with heapsort, so the worst case stays O(n log n). Partitions of at most 16
//! elements are left alone and one insertion-sort pass over the whole array finishes them,
//! as in Musser's paper and the SGI STL `std::sort`. No simplification.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "introsort",
    stable: Stability::No,
    in_place: true,
    kind: Kind::Comparison,
};

const THRESHOLD: usize = 16;

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if n < 2 {
        return Outcome::Sorted;
    }
    let depth = 2 * (usize::BITS - 1 - n.leading_zeros()) as usize;
    t.phase("introsort loop: median-of-3 quicksort with depth limit");
    if !intro_loop(t, v, 0, n, depth) {
        return Outcome::Truncated;
    }
    t.phase("final insertion sort");
    if !insertion(t, v, 0, n) {
        return Outcome::Truncated;
    }
    Outcome::Sorted
}

fn intro_loop(t: &mut Tracer, v: &mut [Item], lo: usize, mut hi: usize, mut depth: usize) -> bool {
    while hi - lo > THRESHOLD {
        if !t.ok() {
            return false;
        }
        if depth == 0 {
            t.phase("depth limit reached: heapsort");
            return heapsort(t, v, lo, hi);
        }
        depth -= 1;
        let pivot = median_of_three(t, v, lo, lo + (hi - lo) / 2, hi - 1);
        t.mark(lo, hi, "partition");
        let cut = partition(t, v, lo, hi, pivot);
        if cut <= lo || cut >= hi {
            // Cannot happen with a median-of-3 pivot; kept as a guard.
            return heapsort(t, v, lo, hi);
        }
        if !intro_loop(t, v, cut, hi, depth) {
            return false;
        }
        hi = cut;
    }
    true
}

fn median_of_three(t: &mut Tracer, v: &[Item], a: usize, b: usize, c: usize) -> Item {
    let (x, y, z) = (t.read(v, a), t.read(v, b), t.read(v, c));
    if t.cmp_items(&x, &y) == Ordering::Less {
        if t.cmp_items(&y, &z) == Ordering::Less {
            y
        } else if t.cmp_items(&x, &z) == Ordering::Less {
            z
        } else {
            x
        }
    } else if t.cmp_items(&x, &z) == Ordering::Less {
        x
    } else if t.cmp_items(&y, &z) == Ordering::Less {
        z
    } else {
        y
    }
}

/// SGI `__unguarded_partition`: returns the cut; [lo, cut) <= pivot <= [cut, hi).
fn partition(t: &mut Tracer, v: &mut [Item], lo: usize, hi: usize, pivot: Item) -> usize {
    let (mut i, mut j) = (lo, hi);
    loop {
        while t.cmp_items(&v[i], &pivot) == Ordering::Less {
            i += 1;
        }
        j -= 1;
        while t.cmp_items(&pivot, &v[j]) == Ordering::Less {
            j -= 1;
        }
        if i >= j {
            return i;
        }
        t.swap(v, i, j);
        i += 1;
    }
}

fn heapsort(t: &mut Tracer, v: &mut [Item], lo: usize, hi: usize) -> bool {
    let n = hi - lo;
    for start in (0..n / 2).rev() {
        sift_down(t, v, lo, start, n);
    }
    for end in (1..n).rev() {
        if !t.ok() {
            return false;
        }
        t.swap(v, lo, lo + end);
        sift_down(t, v, lo, 0, end);
    }
    true
}

fn sift_down(t: &mut Tracer, v: &mut [Item], lo: usize, mut root: usize, n: usize) {
    loop {
        let mut child = 2 * root + 1;
        if child >= n {
            return;
        }
        if child + 1 < n && t.cmp(v, lo + child, lo + child + 1) == Ordering::Less {
            child += 1;
        }
        if t.cmp(v, lo + root, lo + child) != Ordering::Less {
            return;
        }
        t.swap(v, lo + root, lo + child);
        root = child;
    }
}

fn insertion(t: &mut Tracer, v: &mut [Item], lo: usize, hi: usize) -> bool {
    for i in lo + 1..hi {
        if !t.ok() {
            return false;
        }
        let mut j = i;
        while j > lo && t.cmp(v, j - 1, j) == Ordering::Greater {
            t.swap(v, j - 1, j);
            j -= 1;
        }
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
