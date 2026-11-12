//! External quicksort (Knuth, TAOCP Vol. 3, 2nd ed., section 5.4.8 and exercise 5.4.8-1;
//! Gonnet and Baeza-Yates 1991, "Handbook of Algorithms and Data Structures", 2nd ed.,
//! Addison-Wesley, section 4.4).
//!
//! The file (the array) is partitioned in place with a memory of M items (M = ceil(sqrt n),
//! at least 4) holding the "middle group": the file is read alternately from both ends
//! (always from the end whose gap is smaller, so writes never overtake reads); an item
//! smaller than the middle group's minimum is written at the left end, one larger than its
//! maximum at the right end, and otherwise it joins the middle group, which in exchange
//! evicts its minimum to the left or its maximum to the right (towards the side that has
//! received less so far). At the end the middle group, sorted, fills the gap in the middle;
//! both sides are sorted recursively, and a part that fits in memory is sorted there.
//! The middle group is kept as a sorted list (`aux`), standing in for the double-ended
//! priority queue of the description. No other simplification.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "external-quicksort",
    stable: Stability::No,
    in_place: false,
    kind: Kind::External,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    let m = memory_size(n);
    if ext_qs(t, v, 0, n, m) {
        Outcome::Sorted
    } else {
        Outcome::Truncated
    }
}

fn ext_qs(t: &mut Tracer, v: &mut [Item], lo: usize, hi: usize, m: usize) -> bool {
    if !t.ok() {
        return false;
    }
    let n = hi - lo;
    if n < 2 {
        return true;
    }
    if n <= m {
        t.phase("the part fits in memory: internal sort");
        let mut load: Vec<Item> = (lo..hi).map(|i| t.read(v, i)).collect();
        t.aux("memory", &load);
        mem_sort(t, &mut load);
        for (k, x) in load.into_iter().enumerate() {
            t.set(v, lo + k, x);
        }
        t.aux_clear("memory");
        return true;
    }
    t.phase("partition the file around a middle group held in memory");
    t.mark(lo, hi, "partition");
    let (mut rl, mut rr) = (lo, hi); // next unread from the left, one past next unread right
    let (mut wl, mut wr) = (lo, hi); // next free on the left, one past next free right
    let mut mid: Vec<Item> = Vec::with_capacity(m);
    // fill the memory alternately from both ends
    while mid.len() < m {
        let x = if mid.len() % 2 == 0 {
            rl += 1;
            t.read(v, rl - 1)
        } else {
            rr -= 1;
            t.read(v, rr)
        };
        let pos = upper_bound(t, &mid, &x);
        mid.insert(pos, x);
    }
    t.aux("middle group", &mid);
    while rl < rr {
        let x = if rl - wl <= wr - rr {
            rl += 1;
            t.read(v, rl - 1)
        } else {
            rr -= 1;
            t.read(v, rr)
        };
        if t.cmp_items(&x, &mid[0]) == Ordering::Less {
            t.set(v, wl, x);
            wl += 1;
        } else if t.cmp_items(&x, &mid[mid.len() - 1]) == Ordering::Greater {
            wr -= 1;
            t.set(v, wr, x);
        } else {
            let pos = upper_bound(t, &mid, &x);
            mid.insert(pos, x);
            if wl - lo <= hi - wr {
                let y = mid.remove(0);
                t.set(v, wl, y);
                wl += 1;
            } else {
                let y = mid.pop().expect("middle group is not empty");
                wr -= 1;
                t.set(v, wr, y);
            }
            t.aux("middle group", &mid);
        }
    }
    for (k, x) in mid.iter().enumerate() {
        t.set(v, wl + k, *x);
    }
    t.aux_clear("middle group");
    ext_qs(t, v, lo, wl, m) && ext_qs(t, v, wr, hi, m)
}

/// First position in the sorted `a` whose key is greater than `x`.
fn upper_bound(t: &mut Tracer, a: &[Item], x: &Item) -> usize {
    let (mut lo, mut hi) = (0usize, a.len());
    while lo < hi {
        let mid = lo + (hi - lo) / 2;
        if t.cmp_items(x, &a[mid]) == Ordering::Less {
            hi = mid;
        } else {
            lo = mid + 1;
        }
    }
    lo
}

/// Memory size M of the simulation: ceil(sqrt n), at least 4 items.
fn memory_size(n: usize) -> usize {
    let mut m = 4;
    while m * m < n {
        m += 1;
    }
    m
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
