//! Samplesort (Frazer and McKellar 1970, "Samplesort: A Sampling Approach to Minimal
//! Storage Tree Sorting", Journal of the ACM 17(3), 496-507).
//!
//! The documented strategy: draw a random sample, sort it, take k - 1 evenly spaced sample
//! elements as splitters, classify every element by binary search among the splitters,
//! distribute the elements into the k buckets (`aux`), and sort every bucket recursively;
//! small buckets are finished by insertion sort. The sample is oversampled (3 elements per
//! bucket) so the splitters are close to the true quantiles. Keys equal to a splitter get
//! their own bucket, which needs no further sorting (as in later samplesorts such as
//! IPS4o); this guarantees progress on inputs with many equal keys. The distribution and
//! the base case keep input order, so this simulation happens to be stable; samplesort
//! is not specified as a stable sort, and META declares it unstable.
//! k = `options.k` when it is at least 2, otherwise 4.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "samplesort",
    stable: Stability::No,
    in_place: false,
    kind: Kind::Comparison,
};

const SMALL: usize = 32;
const OVERSAMPLE: usize = 3;

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, opt: &Options) -> Outcome {
    let k = if opt.k >= 2 {
        (opt.k as usize).min(256)
    } else {
        4
    };
    let n = v.len();
    if ssort(t, v, 0, n, k, 0) {
        Outcome::Sorted
    } else {
        Outcome::Truncated
    }
}

fn rand_below(t: &mut Tracer, n: usize) -> usize {
    (t.rng().next_u64() % n as u64) as usize
}

fn ssort(t: &mut Tracer, v: &mut [Item], lo: usize, hi: usize, k: usize, depth: usize) -> bool {
    if !t.ok() {
        return false;
    }
    let n = hi - lo;
    if n <= SMALL {
        insertion(t, v, lo, hi);
        return t.ok();
    }
    t.phase(&format!(
        "depth {depth}: draw and sort a sample of {}",
        OVERSAMPLE * k
    ));
    let mut sample: Vec<Item> = (0..OVERSAMPLE * k)
        .map(|_| {
            let p = lo + rand_below(t, n);
            t.read(v, p)
        })
        .collect();
    insertion_items(t, &mut sample);
    let splitters: Vec<Item> = (1..k).map(|i| sample[i * OVERSAMPLE - 1]).collect();
    t.aux("splitters", &splitters);
    t.phase(&format!(
        "depth {depth}: classify and distribute into buckets"
    ));
    let mut buckets: Vec<Vec<Item>> = vec![Vec::new(); 2 * k - 1];
    for i in lo..hi {
        let x = t.read(v, i);
        let b = classify(t, &splitters, &x);
        buckets[b].push(x);
    }
    let mut pos = lo;
    let mut ranges = Vec::new();
    for (b, bucket) in buckets.iter().enumerate() {
        if bucket.is_empty() {
            continue;
        }
        t.aux(&format!("bucket {b}"), bucket);
        let start = pos;
        for x in bucket {
            t.set(v, pos, *x);
            pos += 1;
        }
        t.aux_clear(&format!("bucket {b}"));
        if b % 2 == 0 {
            ranges.push((start, pos)); // equality buckets (odd) are final
        }
    }
    for (a, b) in ranges {
        if !ssort(t, v, a, b, k, depth + 1) {
            return false;
        }
    }
    true
}

/// 2b for keys between splitters b-1 and b, 2b+1 for keys equal to splitter b.
fn classify(t: &mut Tracer, s: &[Item], x: &Item) -> usize {
    let (mut lo, mut hi) = (0usize, s.len());
    while lo < hi {
        let mid = lo + (hi - lo) / 2;
        if t.cmp_items(&s[mid], x) == Ordering::Less {
            lo = mid + 1;
        } else {
            hi = mid;
        }
    }
    if lo < s.len() && t.cmp_items(x, &s[lo]) != Ordering::Less {
        2 * lo + 1
    } else {
        2 * lo
    }
}

fn insertion_items(t: &mut Tracer, a: &mut [Item]) {
    for i in 1..a.len() {
        let mut j = i;
        while j > 0 && t.cmp_items(&a[j - 1], &a[j]) == Ordering::Greater {
            a.swap(j - 1, j);
            j -= 1;
        }
    }
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
}
