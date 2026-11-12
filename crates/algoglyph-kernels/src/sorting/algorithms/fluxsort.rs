//! Fluxsort (Igor van den Hoven, official repository https://github.com/scandum/fluxsort).
//!
//! The documented strategy: a stable quicksort. A partition moves the elements smaller
//! than the pivot to the front of the array in order and the rest into a swap buffer of
//! n elements in order, then copies the buffer back behind them, which keeps the sort
//! stable. The pivot is a pseudomedian of nine for large partitions (median of three
//! otherwise). When a partition's pivot is not smaller than anything, fluxsort runs a
//! "reverse" partition (elements <= pivot to the front): every element of the front part
//! then equals the pivot and is final, which makes runs of equal keys cost O(n).
//! Before partitioning, an analysis pass leaves already-sorted input untouched.
//!
//! Simplifications: small partitions (at most 24 elements) are finished by a stable
//! binary insertion sort instead of quadsort, and the analysis pass only detects input
//! that is already sorted (the repository also detects reverse order and sorted
//! quarters and hands those to quadsort).
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "fluxsort",
    stable: Stability::Yes,
    in_place: false,
    kind: Kind::Comparison,
};

const SMALL: usize = 24;

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    t.phase("analyze: is the input already sorted?");
    if (1..n).all(|i| t.cmp(v, i - 1, i) != Ordering::Greater) {
        return Outcome::Sorted;
    }
    let mut swap: Vec<Item> = Vec::with_capacity(n);
    if !flux(t, v, 0, n, &mut swap, None) {
        return Outcome::Truncated;
    }
    Outcome::Sorted
}

/// Sorts [lo, hi) stably. `max` is the pivot of the enclosing partition when this range is
/// its right part (every element here is >= it).
fn flux(
    t: &mut Tracer,
    v: &mut [Item],
    lo: usize,
    hi: usize,
    swap: &mut Vec<Item>,
    max: Option<Item>,
) -> bool {
    if !t.ok() {
        return false;
    }
    let n = hi - lo;
    if n <= SMALL {
        binary_insertion(t, v, lo, hi);
        return t.ok();
    }
    let pivot = choose_pivot(t, v, lo, hi);
    // If the pivot is not greater than the previous pivot, every element is >= pivot:
    // partition by <= and the front part, all equal to the pivot, is done.
    if let Some(m) = max {
        if t.cmp_items(&pivot, &m) != Ordering::Greater {
            t.phase("reverse partition: elements equal to the pivot are final");
            let mid = stable_partition(t, v, lo, hi, swap, &pivot, true);
            return flux(t, v, mid, hi, swap, None);
        }
    }
    t.phase("partition: smaller to the front, the rest through the swap buffer");
    let mid = stable_partition(t, v, lo, hi, swap, &pivot, false);
    if mid == lo {
        // Nothing smaller than the pivot: the pivot is the minimum; reverse partition.
        t.phase("reverse partition: elements equal to the pivot are final");
        let mid = stable_partition(t, v, lo, hi, swap, &pivot, true);
        return flux(t, v, mid, hi, swap, None);
    }
    flux(t, v, lo, mid, swap, max) && flux(t, v, mid, hi, swap, Some(pivot))
}

/// Stable partition of [lo, hi): elements `< pivot` (or `<= pivot` when `reverse`) keep
/// their order at the front; the others go to the swap buffer and are copied back behind
/// them. Returns the boundary.
fn stable_partition(
    t: &mut Tracer,
    v: &mut [Item],
    lo: usize,
    hi: usize,
    swap: &mut Vec<Item>,
    pivot: &Item,
    reverse: bool,
) -> usize {
    swap.clear();
    let mut front = lo;
    t.mark(lo, hi, "partition");
    for i in lo..hi {
        let x = t.read(v, i);
        let c = t.cmp_items(&x, pivot);
        let to_front = if reverse {
            c != Ordering::Greater
        } else {
            c == Ordering::Less
        };
        if to_front {
            t.set(v, front, x);
            front += 1;
        } else {
            swap.push(x);
        }
    }
    t.aux("swap", swap);
    for (k, x) in swap.iter().enumerate() {
        t.set(v, front + k, *x);
    }
    front
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
    let n = hi - lo;
    if n > 64 {
        let s = n / 9;
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
    } else {
        let (a, b, c) = (t.read(v, lo), t.read(v, lo + n / 2), t.read(v, hi - 1));
        median3(t, a, b, c)
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
}
