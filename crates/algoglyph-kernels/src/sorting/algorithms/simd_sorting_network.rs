//! SIMD sorting network merge sort (Inoue, Moriyama, Komatsu and Nakatani 2007, "AA-Sort:
//! A New Parallel Sorting Algorithm for Multi-Core SIMD Processors", PACT 2007, 189-198;
//! Chhugani, Nguyen, Lee, Macy, Hagog, Chen, Baransi, Kumar and Dubey 2008, "Efficient
//! implementation of sorting on multi-core SIMD CPU architecture", PVLDB 1(2), 1313-1324).
//!
//! The documented strategy with 4-wide vector registers, one `t.lane(l)` per SIMD lane:
//! 1. in-register sort: blocks of 16 keys are loaded into 4 registers; the optimal 4-input
//!    network (5 comparators) runs between registers, i.e. on all 4 columns at once with
//!    min/max instructions; a 4x4 transpose then leaves every register a sorted run of 4;
//! 2. merge passes: runs of 4, 8, 16, ... are merged pairwise by the vectorised bitonic
//!    merge kernel: a register of 4 from one run and the next 4 from whichever run has the
//!    smaller head are merged by a bitonic network (reverse, min/max, two half-cleaner
//!    levels); the lower 4 are output and the upper 4 stay in the register.
//! The input is padded with +infinity to a multiple of 16, as vector code pads; the real
//! items are written back to the array after every step. Unstable: the min/max network
//! does not preserve the order of equal keys. No simplification of the kernels.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "simd-sorting-network",
    stable: Stability::No,
    in_place: false,
    kind: Kind::Network,
};

const W: usize = 4;

#[derive(Clone, Copy)]
enum Cell {
    Val(Item),
    Inf,
}

fn cmp_cell(t: &mut Tracer, a: &Cell, b: &Cell) -> Ordering {
    match (a, b) {
        (Cell::Val(x), Cell::Val(y)) => t.cmp_items(x, y),
        (Cell::Inf, Cell::Inf) => Ordering::Equal,
        (Cell::Inf, _) => Ordering::Greater,
        (_, Cell::Inf) => Ordering::Less,
    }
}

/// One vector min/max: lane-wise (min, max) of two registers.
fn minmax(t: &mut Tracer, a: &mut [Cell; W], b: &mut [Cell; W]) {
    for l in 0..W {
        t.lane(l as u32);
        if cmp_cell(t, &a[l], &b[l]) == Ordering::Greater {
            core::mem::swap(&mut a[l], &mut b[l]);
        }
    }
}

/// Sorts a bitonic register of 4 with two half-cleaner levels.
fn bitonic4(t: &mut Tracer, r: &mut [Cell; W]) {
    for (i, j) in [(0, 2), (1, 3), (0, 1), (2, 3)] {
        t.lane(i as u32);
        if cmp_cell(t, &r[i], &r[j]) == Ordering::Greater {
            r.swap(i, j);
        }
    }
}

/// Bitonic merge of two sorted registers: returns (lower 4, upper 4), both sorted.
fn merge4(t: &mut Tracer, a: [Cell; W], b: [Cell; W]) -> ([Cell; W], [Cell; W]) {
    let mut lo = a;
    let mut hi = [b[3], b[2], b[1], b[0]];
    minmax(t, &mut lo, &mut hi);
    bitonic4(t, &mut lo);
    bitonic4(t, &mut hi);
    (lo, hi)
}

fn reg(w: &[Cell], at: usize) -> [Cell; W] {
    [w[at], w[at + 1], w[at + 2], w[at + 3]]
}

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if n < 2 {
        return Outcome::Sorted;
    }
    let big_n = n.div_ceil(16) * 16;
    t.phase("load registers (pad to a multiple of 16 with +infinity)");
    let mut w: Vec<Cell> = (0..big_n)
        .map(|i| {
            if i < n {
                Cell::Val(t.read(v, i))
            } else {
                Cell::Inf
            }
        })
        .collect();

    t.phase("in-register sort: 4-input network across registers, then 4x4 transpose");
    for base in (0..big_n).step_by(16) {
        let mut r = [
            reg(&w, base),
            reg(&w, base + 4),
            reg(&w, base + 8),
            reg(&w, base + 12),
        ];
        for (a, b) in [(0, 1), (2, 3), (0, 2), (1, 3), (1, 2)] {
            let (x, y) = two(&mut r, a, b);
            minmax(t, x, y);
        }
        for i in 0..W {
            for j in 0..W {
                w[base + 4 * i + j] = r[j][i]; // transpose: register i = column i
            }
        }
    }
    write_back(t, v, &w);
    if !t.ok() {
        return Outcome::Truncated;
    }

    let mut run = W;
    while run < big_n {
        t.phase(&format!(
            "merge runs of {run} with the bitonic merge kernel"
        ));
        let mut out: Vec<Cell> = Vec::with_capacity(big_n);
        let mut lo = 0;
        while lo < big_n {
            let mid = (lo + run).min(big_n);
            let hi = (lo + 2 * run).min(big_n);
            if mid == hi {
                out.extend_from_slice(&w[lo..hi]);
            } else {
                merge_runs(t, &w[lo..mid], &w[mid..hi], &mut out);
            }
            lo = hi;
        }
        w = out;
        write_back(t, v, &w);
        if !t.ok() {
            return Outcome::Truncated;
        }
        run *= 2;
    }
    Outcome::Sorted
}

fn two<'a>(
    r: &'a mut [[Cell; W]; 4],
    a: usize,
    b: usize,
) -> (&'a mut [Cell; W], &'a mut [Cell; W]) {
    let (x, y) = r.split_at_mut(b);
    (&mut x[a], &mut y[0])
}

/// Streaming merge of two sorted runs (lengths multiples of 4) with the vector kernel.
fn merge_runs(t: &mut Tracer, a: &[Cell], b: &[Cell], out: &mut Vec<Cell>) {
    let (mut ia, mut ib) = (W, 0usize);
    let mut r = reg(a, 0);
    loop {
        let take_a = if ia < a.len() && ib < b.len() {
            cmp_cell(t, &a[ia], &b[ib]) != Ordering::Greater
        } else if ia < a.len() {
            true
        } else if ib < b.len() {
            false
        } else {
            break;
        };
        let chunk = if take_a {
            ia += W;
            reg(a, ia - W)
        } else {
            ib += W;
            reg(b, ib - W)
        };
        let (lo, hi) = merge4(t, r, chunk);
        out.extend_from_slice(&lo);
        r = hi;
    }
    out.extend_from_slice(&r);
}

fn write_back(t: &mut Tracer, v: &mut [Item], w: &[Cell]) {
    let mut i = 0;
    for cell in w {
        if let Cell::Val(x) = cell {
            if v[i].key != x.key || v[i].tag != x.tag {
                t.set(v, i, *x);
            }
            i += 1;
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
    fn zero_one_principle_exhaustive() {
        for n in 0..=11usize {
            for mask in 0u32..(1u32 << n) {
                let input = keyed((0..n).map(|i| ((mask >> i) & 1) as i32));
                let (out, outcome, _) = run(&input, &count_only());
                assert_eq!(outcome, Outcome::Sorted);
                assert!(
                    out.windows(2).all(|w| w[0].key <= w[1].key),
                    "n = {n}, mask = {mask:b}"
                );
            }
        }
    }
}
