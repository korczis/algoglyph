//! Parallel LSD radix sort (Zagha and Blelloch 1991, "Radix sort for vector
//! multiprocessors", Supercomputing '91, 712-721; Blelloch et al. 1991, "A comparison of
//! sorting algorithms for the Connection Machine CM-2", SPAA 1991).
//!
//! The documented strategy for p processors, one lane each (`t.lane(l)`), per digit from
//! the least significant:
//! 1. local histogram: every processor counts the digits of its own block;
//! 2. global scan: an exclusive prefix sum over the (digit, processor) table, digit-major,
//!    gives every processor its write offset for every digit;
//! 3. scatter: every processor writes its elements to their offsets in the output buffer
//!    (`aux`), which becomes the input of the next pass.
//! Offsets are digit-major then processor-major and each processor scans its block in
//! order, so every pass is stable and so is the sort.
//! Keys are taken relative to the minimum key (so negative keys work and the number of
//! passes follows the key range). The radix is `options.base` (2 ..= 65536), default 16;
//! p = `options.k` when it is at least 2, otherwise 4. No simplification.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "parallel-radix-sort",
    stable: Stability::Yes,
    in_place: false,
    kind: Kind::Distribution,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, opt: &Options) -> Outcome {
    let n = v.len();
    if n < 2 {
        return Outcome::Sorted;
    }
    let base = if (2..=65536).contains(&opt.base) {
        opt.base as u64
    } else {
        16
    };
    let p = if opt.k >= 2 {
        (opt.k as usize).min(64)
    } else {
        4
    };
    t.phase("find the minimum and maximum key");
    let (mut min, mut max) = (i64::MAX, i64::MIN);
    for i in 0..n {
        let k = t.read(v, i).key as i64;
        min = min.min(k);
        max = max.max(k);
    }
    let range = (max - min) as u64;
    let block = n.div_ceil(p);
    let mut div = 1u64;
    let mut pass = 0;
    loop {
        pass += 1;
        let digit = |x: &Item| (((x.key as i64 - min) as u64 / div) % base) as usize;
        t.phase(&format!("pass {pass}: local histograms"));
        let mut hist = vec![vec![0usize; base as usize]; p];
        for (l, h) in hist.iter_mut().enumerate() {
            t.lane(l as u32);
            for i in (l * block).min(n)..((l + 1) * block).min(n) {
                let x = t.read(v, i);
                h[digit(&x)] += 1;
            }
        }
        t.phase(&format!("pass {pass}: global prefix sum"));
        let mut acc = 0usize;
        let mut offset = vec![vec![0usize; base as usize]; p];
        for d in 0..base as usize {
            for l in 0..p {
                offset[l][d] = acc;
                acc += hist[l][d];
            }
        }
        t.phase(&format!("pass {pass}: scatter"));
        let mut out = vec![Item::new(0, 0); n];
        for (l, off) in offset.iter_mut().enumerate() {
            t.lane(l as u32);
            for i in (l * block).min(n)..((l + 1) * block).min(n) {
                let x = v[i];
                let d = digit(&x);
                out[off[d]] = x;
                off[d] += 1;
            }
        }
        t.aux("output buffer", &out);
        for (i, x) in out.into_iter().enumerate() {
            t.set(v, i, x);
        }
        if !t.ok() {
            return Outcome::Truncated;
        }
        match div.checked_mul(base) {
            Some(d) if d <= range => div = d,
            _ => break,
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
