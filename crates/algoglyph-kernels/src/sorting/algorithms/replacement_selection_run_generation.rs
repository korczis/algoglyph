//! Replacement selection run generation (Knuth, TAOCP Vol. 3, 2nd ed., section 5.4.1,
//! Algorithm R; Goetz 1963, "Internal and tape sorting using the replacement-selection
//! technique", Communications of the ACM 6(5), 201-206).
//!
//! The documented strategy: memory holds a heap of M items (M = ceil(sqrt n), at least 4)
//! ordered by (run number, key). The smallest item of the current run is output; the next
//! input item takes its place, in the same run if it is not smaller than the item just
//! output, otherwise tagged for the next run. A run ends when every item in the heap
//! belongs to the next run. On random input the runs average 2M items, twice the length of
//! sorted memory loads, and sorted input gives a single run. `aux` shows the heap and the
//! runs written so far.
//! Replacement selection only produces runs; to make the output sorted, the runs are then
//! merged by one multiway merge (the merge phase of `external-merge-sort`).
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "replacement-selection-run-generation",
    stable: Stability::No,
    in_place: false,
    kind: Kind::External,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if n < 2 {
        return Outcome::Sorted;
    }
    let m = memory_size(n);
    t.phase(&format!("fill the heap with M = {m} items"));
    let mut heap: Vec<(u32, Item)> = Vec::with_capacity(m);
    let mut next = 0;
    while next < n && heap.len() < m {
        let x = t.read(v, next);
        next += 1;
        heap.push((0, x));
        sift_up(t, &mut heap);
    }
    show_heap(t, &heap);
    t.phase("replacement selection: output the minimum, replace it with the next input");
    let mut runs: Vec<Vec<Item>> = Vec::new();
    while let Some((r, x)) = pop(t, &mut heap) {
        if r as usize == runs.len() {
            runs.push(Vec::new());
            t.phase(&format!("run {} starts", runs.len()));
        }
        runs[r as usize].push(x);
        if next < n {
            let y = t.read(v, next);
            next += 1;
            let run = if t.cmp_items(&y, &x) == Ordering::Less {
                r + 1
            } else {
                r
            };
            heap.push((run, y));
            sift_up(t, &mut heap);
        }
        show_heap(t, &heap);
        show_tape(t, "runs on disk", &runs);
        if !t.ok() {
            return Outcome::Truncated;
        }
    }
    t.aux_clear("heap");
    t.phase(&format!("merge the {} runs", runs.len()));
    let out = kway_merge(t, &runs);
    write_out(t, v, &out);
    t.aux_clear("runs on disk");
    Outcome::Sorted
}

fn less(t: &mut Tracer, a: &(u32, Item), b: &(u32, Item)) -> bool {
    if a.0 != b.0 {
        a.0 < b.0
    } else {
        t.cmp_items(&a.1, &b.1) == Ordering::Less
    }
}

fn sift_up(t: &mut Tracer, h: &mut [(u32, Item)]) {
    let mut i = h.len() - 1;
    while i > 0 {
        let p = (i - 1) / 2;
        if less(t, &h[i], &h[p]) {
            h.swap(i, p);
            i = p;
        } else {
            break;
        }
    }
}

fn pop(t: &mut Tracer, h: &mut Vec<(u32, Item)>) -> Option<(u32, Item)> {
    if h.is_empty() {
        return None;
    }
    let last = h.len() - 1;
    h.swap(0, last);
    let top = h.pop();
    let n = h.len();
    let mut i = 0;
    loop {
        let (l, r) = (2 * i + 1, 2 * i + 2);
        let mut s = i;
        if l < n && less(t, &h[l], &h[s]) {
            s = l;
        }
        if r < n && less(t, &h[r], &h[s]) {
            s = r;
        }
        if s == i {
            break;
        }
        h.swap(i, s);
        i = s;
    }
    top
}

fn show_heap(t: &mut Tracer, h: &[(u32, Item)]) {
    let items: Vec<Item> = h.iter().map(|&(_, x)| x).collect();
    t.aux("heap", &items);
}

/// Memory size M of the simulation: ceil(sqrt n), at least 4 items.
fn memory_size(n: usize) -> usize {
    let mut m = 4;
    while m * m < n {
        m += 1;
    }
    m
}

/// Stable k-way merge of sorted runs (ties go to the lower run), selecting the smallest
/// head by a scan of the k heads.
fn kway_merge(t: &mut Tracer, runs: &[Vec<Item>]) -> Vec<Item> {
    let mut idx = vec![0usize; runs.len()];
    let total: usize = runs.iter().map(|r| r.len()).sum();
    let mut out = Vec::with_capacity(total);
    while out.len() < total {
        let mut best: Option<usize> = None;
        for (r, run) in runs.iter().enumerate() {
            if idx[r] >= run.len() {
                continue;
            }
            best = match best {
                None => Some(r),
                Some(b) if t.cmp_items(&run[idx[r]], &runs[b][idx[b]]) == Ordering::Less => Some(r),
                keep => keep,
            };
        }
        let b = best.expect("a run with items left");
        out.push(runs[b][idx[b]]);
        idx[b] += 1;
    }
    out
}

/// Writes the final run back to the array.
fn write_out(t: &mut Tracer, v: &mut [Item], run: &[Item]) {
    for (i, x) in run.iter().enumerate() {
        t.set(v, i, *x);
    }
}

/// Snapshot of a tape: its runs concatenated.
fn show_tape<'a>(t: &mut Tracer, name: &str, runs: impl IntoIterator<Item = &'a Vec<Item>>) {
    let flat: Vec<Item> = runs.into_iter().flatten().copied().collect();
    t.aux(name, &flat);
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
