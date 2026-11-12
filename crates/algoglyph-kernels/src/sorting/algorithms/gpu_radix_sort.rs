//! GPU radix sort (Satish, Harris and Garland 2009, "Designing efficient sorting
//! algorithms for manycore GPUs", IPDPS 2009; Merrill and Grimshaw 2011, "High Performance
//! and Scalable Radix Sorting", Parallel Processing Letters 21(2), 245-272).
//!
//! The documented strategy, LSD with 4-bit digits, per pass three GPU kernels; the input is
//! cut into tiles, one thread block each (`t.lane(block)`):
//! 1. local sort + histogram: every block sorts its tile by the current digit in shared
//!    memory (a stable split by the digit, done with a prefix scan of the digit flags) and
//!    counts the 16 digit values (`aux` shows the tile);
//! 2. global scan: an exclusive prefix sum over the 16 x blocks table, digit-major, gives
//!    each block's offset for each digit;
//! 3. scatter: every block writes its locally sorted tile to the global offsets; the local
//!    sort makes these writes coalesced, which is why the step exists.
//! Every step preserves the order of equal digits, so the sort is stable. Keys are taken
//! relative to the minimum key, and the number of passes follows the key range.
//! Tiles hold 64 keys (real kernels use 256 threads x several keys). No other
//! simplification.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "gpu-radix-sort",
    stable: Stability::Yes,
    in_place: false,
    kind: Kind::Distribution,
};

const BITS: u32 = 4;
const RADIX: usize = 1 << BITS;
const TILE: usize = 64;

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if n < 2 {
        return Outcome::Sorted;
    }
    t.phase("find the key range");
    let (mut min, mut max) = (i64::MAX, i64::MIN);
    for i in 0..n {
        let k = t.read(v, i).key as i64;
        min = min.min(k);
        max = max.max(k);
    }
    let range = (max - min) as u64;
    let blocks = n.div_ceil(TILE);
    let mut shift = 0u32;
    let mut pass = 0;
    loop {
        pass += 1;
        let digit = |x: &Item| ((((x.key as i64 - min) as u64) >> shift) as usize) & (RADIX - 1);
        t.round();
        t.phase(&format!(
            "pass {pass}, kernel 1: local split sort by digit + histogram"
        ));
        let mut hist = vec![[0usize; RADIX]; blocks];
        for (b, h) in hist.iter_mut().enumerate() {
            t.lane(b as u32);
            let (lo, hi) = (b * TILE, ((b + 1) * TILE).min(n));
            let tile: Vec<Item> = (lo..hi).map(|i| t.read(v, i)).collect();
            // stable counting split inside shared memory
            for x in &tile {
                h[digit(x)] += 1;
            }
            let mut start = [0usize; RADIX];
            for d in 1..RADIX {
                start[d] = start[d - 1] + h[d - 1];
            }
            let mut local = tile.clone();
            for x in &tile {
                let d = digit(x);
                local[start[d]] = *x;
                start[d] += 1;
            }
            t.aux(&format!("shared memory, block {b}"), &local);
            for (k, x) in local.into_iter().enumerate() {
                t.set(v, lo + k, x);
            }
        }
        t.round();
        t.phase(&format!("pass {pass}, kernel 2: global digit-major scan"));
        let mut offset = vec![[0usize; RADIX]; blocks];
        let mut acc = 0usize;
        for d in 0..RADIX {
            for b in 0..blocks {
                offset[b][d] = acc;
                acc += hist[b][d];
            }
        }
        t.round();
        t.phase(&format!("pass {pass}, kernel 3: coalesced scatter"));
        let mut out = vec![Item::new(0, 0); n];
        for (b, off) in offset.iter_mut().enumerate() {
            t.lane(b as u32);
            for i in b * TILE..((b + 1) * TILE).min(n) {
                let x = v[i];
                let d = digit(&x);
                out[off[d]] = x;
                off[d] += 1;
            }
        }
        for (i, x) in out.into_iter().enumerate() {
            t.set(v, i, x);
        }
        if !t.ok() {
            return Outcome::Truncated;
        }
        shift += BITS;
        if shift >= 64 || (range >> shift) == 0 {
            break;
        }
    }
    Outcome::Sorted
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
