//! Weavesort, implemented as weave merge sort.
//!
//! No authoritative specification of "Weavesort" (paper or official repository) was
//! available to this implementer; this is the weave merge sort known from sorting
//! visualisers: a top-down merge sort whose merge step first "weaves" the two sorted halves
//! into each other (a perfect shuffle a1 b1 a2 b2 ..., done in place by recursive block
//! rotations) and then repairs the order with an insertion sort over the woven range. The
//! weave moves every element near the position it would have in a merge of interleaved
//! inputs, so the insertion pass is cheap on mixed data, but in the worst case (one half
//! entirely below the other) it is quadratic. Treat the family assignment and this reading
//! as unverified until the writer's sources confirm them.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "weavesort",
    stable: Stability::No,
    in_place: true,
    kind: Kind::Comparison,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if weave_sort(t, v, 0, n) {
        Outcome::Sorted
    } else {
        Outcome::Truncated
    }
}

fn weave_sort(t: &mut Tracer, v: &mut [Item], lo: usize, hi: usize) -> bool {
    let n = hi - lo;
    if n < 2 {
        return true;
    }
    if !t.ok() {
        return false;
    }
    let a = (n + 1) / 2; // left half is the longer one, so the weave starts and ends with it
    if !weave_sort(t, v, lo, lo + a) || !weave_sort(t, v, lo + a, hi) {
        return false;
    }
    if t.cmp(v, lo + a - 1, lo + a) != Ordering::Greater {
        return true; // halves already in order
    }
    t.phase("weave the halves");
    t.mark(lo, hi, "weave");
    weave(t, v, lo, a, n - a);
    t.phase("insertion sort over the woven range");
    for i in lo + 1..hi {
        let mut j = i;
        while j > lo && t.cmp(v, j - 1, j) == Ordering::Greater {
            t.swap(v, j - 1, j);
            j -= 1;
        }
    }
    t.ok()
}

/// Perfect shuffle of A = [lo, lo+a) and B = [lo+a, lo+a+b), a == b or a == b + 1,
/// into a1 b1 a2 b2 ... by recursive rotations.
fn weave(t: &mut Tracer, v: &mut [Item], lo: usize, a: usize, b: usize) {
    if b == 0 || a + b <= 2 {
        return;
    }
    let p = (a + 1) / 2;
    let q = p.min(b);
    // [A0..p | A p..a | B0..q | B q..b] -> [A0..p | B0..q | A p..a | B q..b]
    rotate(t, v, lo + p, lo + a, lo + a + q);
    weave(t, v, lo, p, q);
    weave(t, v, lo + p + q, a - p, b - q);
}

/// Rotates [first, middle) and [middle, last) by three reversals.
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

    const MAX_N: usize = 300;

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
