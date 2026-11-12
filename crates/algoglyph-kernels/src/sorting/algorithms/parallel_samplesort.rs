//! Parallel samplesort (Blelloch, Leiserson, Maggs, Plaxton, Smith and Zagha 1991, "A
//! comparison of sorting algorithms for the Connection Machine CM-2", SPAA 1991, 3-16;
//! Huang and Chow 1983, "Parallel sorting and data partitioning by sampling", COMPSAC).
//!
//! The documented strategy for p processors, simulated in one thread with one lane per
//! processor (`t.lane(l)`):
//! 1. sample: draw a random oversampled sample (8 per processor), sort it and pick p - 1
//!    evenly spaced splitters;
//! 2. classify: every processor classifies the elements of its own block by binary search
//!    among the splitters and counts them per bucket;
//! 3. exchange: an all-to-all step sends bucket b of every processor to processor b, in
//!    processor order (`aux` shows what each processor receives);
//! 4. local sort: every processor sorts its bucket sequentially (a stable merge sort);
//! 5. the buckets, in order, are the sorted output.
//! The distribution keeps the input order inside each bucket, so this simulation happens
//! to be stable; the algorithm is not specified as stable and META declares it unstable.
//! p = `options.k` when it is at least 2, otherwise 4.
//!
//! Rounds (`t.round()`): one per step that every processor runs: classify, exchange,
//! local sort, concatenate.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "parallel-samplesort",
    stable: Stability::No,
    in_place: false,
    kind: Kind::Comparison,
};

const OVERSAMPLE: usize = 8;

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, opt: &Options) -> Outcome {
    let n = v.len();
    let p = if opt.k >= 2 {
        (opt.k as usize).min(64)
    } else {
        4
    };
    if n < 2 {
        return Outcome::Sorted;
    }
    t.phase("sample: draw, sort, pick splitters");
    let mut sample: Vec<Item> = (0..OVERSAMPLE * p)
        .map(|_| {
            let i = (t.rng().next_u64() % n as u64) as usize;
            t.read(v, i)
        })
        .collect();
    merge_sort(t, &mut sample);
    let splitters: Vec<Item> = (1..p).map(|i| sample[i * OVERSAMPLE - 1]).collect();
    t.aux("splitters", &splitters);

    t.round();
    t.phase("classify: every processor its own block");
    let block = n.div_ceil(p);
    let mut sent: Vec<Vec<Vec<Item>>> = vec![vec![Vec::new(); p]; p]; // [lane][bucket]
    for l in 0..p {
        t.lane(l as u32);
        for i in (l * block).min(n)..((l + 1) * block).min(n) {
            let x = t.read(v, i);
            let b = upper_bound(t, &splitters, &x);
            sent[l][b].push(x);
        }
    }
    if !t.ok() {
        return Outcome::Truncated;
    }
    t.round();
    t.phase("exchange: bucket b of every processor goes to processor b");
    let mut received: Vec<Vec<Item>> = vec![Vec::new(); p];
    for (b, recv) in received.iter_mut().enumerate() {
        for lane in sent.iter() {
            recv.extend_from_slice(&lane[b]);
        }
    }
    for (b, recv) in received.iter().enumerate() {
        t.lane(b as u32);
        t.aux(&format!("processor {b}"), recv);
    }
    t.round();
    t.phase("local sort: every processor sorts its bucket");
    for (b, recv) in received.iter_mut().enumerate() {
        t.lane(b as u32);
        merge_sort(t, recv);
        t.aux(&format!("processor {b}"), recv);
        if !t.ok() {
            return Outcome::Truncated;
        }
    }
    t.round();
    t.phase("concatenate the buckets");
    let mut pos = 0;
    for (b, recv) in received.iter().enumerate() {
        t.lane(b as u32);
        for x in recv {
            t.set(v, pos, *x);
            pos += 1;
        }
    }
    Outcome::Sorted
}

/// Number of splitters <= x: equal keys always land in the same bucket.
fn upper_bound(t: &mut Tracer, s: &[Item], x: &Item) -> usize {
    let (mut lo, mut hi) = (0usize, s.len());
    while lo < hi {
        let mid = lo + (hi - lo) / 2;
        if t.cmp_items(x, &s[mid]) == Ordering::Less {
            hi = mid;
        } else {
            lo = mid + 1;
        }
    }
    lo
}

fn merge_sort(t: &mut Tracer, a: &mut [Item]) {
    let n = a.len();
    if n < 2 {
        return;
    }
    let mid = n / 2;
    merge_sort(t, &mut a[..mid]);
    merge_sort(t, &mut a[mid..]);
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
}
