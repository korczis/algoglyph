//! Crumsort (Igor van den Hoven, official repository https://github.com/scandum/crumsort).
//!
//! The documented strategy: an in-place, unstable quicksort that partitions with the
//! "fulcrum" scheme. A fixed swap area takes 16 elements from each end of the partition,
//! which opens a gap at both ends. Elements are then read from whichever end has the
//! smaller gap and written either to the left side (<= pivot) or to the right side
//! (> pivot); the gaps can never close, so no unread element is overwritten. Finally the
//! 32 parked elements are partitioned the same way. As in fluxsort, a pivot that is not
//! greater than the previous pivot splits off the keys equal to it, and a pivot that is the
//! maximum triggers a reverse partition (< pivot to the left), so runs of equal keys are
//! finished in linear time. The larger part is sorted in a loop, the
//! smaller one recursively.
//!
//! Simplifications: partitions of at most 64 elements are finished by insertion sort
//! instead of quadsort's small-array sort; the pivot is a pseudomedian of nine (the
//! repository uses the median of a cube-root-sized sample for very large arrays); the
//! fulcrum loop handles one element per iteration instead of unrolled blocks of 16.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "crumsort",
    stable: Stability::No,
    in_place: true,
    kind: Kind::Comparison,
};

const SMALL: usize = 64;
const PARK: usize = 16;

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if crum(t, v, 0, n, None) {
        Outcome::Sorted
    } else {
        Outcome::Truncated
    }
}

fn crum(
    t: &mut Tracer,
    v: &mut [Item],
    mut lo: usize,
    mut hi: usize,
    mut max: Option<Item>,
) -> bool {
    loop {
        if !t.ok() {
            return false;
        }
        if hi - lo <= SMALL {
            insertion(t, v, lo, hi);
            return t.ok();
        }
        let pivot = choose_pivot(t, v, lo, hi);
        let reverse = match max {
            Some(m) => t.cmp_items(&pivot, &m) != Ordering::Greater,
            None => false,
        };
        if reverse {
            // Every element is >= max >= pivot, so the elements <= pivot equal it: they
            // are final, and only the part greater than the pivot is left.
            t.phase("equal-key partition: keys equal to the previous pivot are final");
            lo = fulcrum(t, v, lo, hi, &pivot, false);
            max = None;
            continue;
        }
        t.phase("fulcrum partition");
        let mid = fulcrum(t, v, lo, hi, &pivot, false);
        if mid == hi {
            // Nothing greater than the pivot: the pivot is the maximum.
            t.phase("reverse fulcrum partition: keys equal to the pivot are final");
            hi = fulcrum(t, v, lo, hi, &pivot, true);
            continue;
        }
        // Left [lo, mid) <= pivot, right [mid, hi) > pivot.
        if mid - lo <= hi - mid {
            if !crum(t, v, lo, mid, max) {
                return false;
            }
            lo = mid;
            max = Some(pivot);
        } else {
            if !crum(t, v, mid, hi, Some(pivot)) {
                return false;
            }
            hi = mid;
        }
    }
}

/// In-place fulcrum partition. Left side gets `x <= pivot` (`x < pivot` when `reverse`).
/// Returns the boundary.
fn fulcrum(
    t: &mut Tracer,
    v: &mut [Item],
    lo: usize,
    hi: usize,
    pivot: &Item,
    reverse: bool,
) -> usize {
    let goes_left = |t: &mut Tracer, x: &Item| {
        let c = t.cmp_items(x, pivot);
        if reverse {
            c == Ordering::Less
        } else {
            c != Ordering::Greater
        }
    };
    let mut park: Vec<Item> = Vec::with_capacity(2 * PARK);
    for i in 0..PARK {
        park.push(t.read(v, lo + i));
    }
    for i in 0..PARK {
        park.push(t.read(v, hi - PARK + i));
    }
    t.aux("swap", &park);
    // Write cursors: left `wl` (next free slot), right `wr` (one past the next free slot).
    // Read cursors: `rl` (next unread from the left), `rr` (one past the next unread from
    // the right). Gaps: rl - wl on the left, wr - rr on the right; their sum stays 32.
    let (mut wl, mut wr) = (lo, hi);
    let (mut rl, mut rr) = (lo + PARK, hi - PARK);
    t.mark(lo, hi, "fulcrum");
    while rl < rr {
        let x = if rl - wl <= wr - rr {
            let x = t.read(v, rl);
            rl += 1;
            x
        } else {
            rr -= 1;
            t.read(v, rr)
        };
        if goes_left(t, &x) {
            t.set(v, wl, x);
            wl += 1;
        } else {
            wr -= 1;
            t.set(v, wr, x);
        }
    }
    for x in park {
        if goes_left(t, &x) {
            t.set(v, wl, x);
            wl += 1;
        } else {
            wr -= 1;
            t.set(v, wr, x);
        }
    }
    wl
}

fn median3(t: &mut Tracer, a: Item, b: Item, c: Item) -> Item {
    let ab = t.cmp_items(&a, &b) == Ordering::Greater;
    let ac = t.cmp_items(&a, &c) == Ordering::Greater;
    if ab != ac {
        return a;
    }
    let bc = t.cmp_items(&b, &c) == Ordering::Greater;
    if ab == bc {
        b
    } else {
        c
    }
}

fn choose_pivot(t: &mut Tracer, v: &[Item], lo: usize, hi: usize) -> Item {
    let s = (hi - lo) / 9;
    let mut m = [Item::new(0, 0); 3];
    for (g, slot) in m.iter_mut().enumerate() {
        let base = lo + 3 * g * s;
        let (a, b, c) = (
            t.read(v, base),
            t.read(v, base + s),
            t.read(v, base + 2 * s),
        );
        *slot = median3(t, a, b, c);
    }
    median3(t, m[0], m[1], m[2])
}

fn insertion(t: &mut Tracer, v: &mut [Item], lo: usize, hi: usize) {
    for i in lo + 1..hi {
        let mut j = i;
        while j > lo && t.cmp(v, j - 1, j) == Ordering::Greater {
            t.swap(v, j - 1, j);
            j -= 1;
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
