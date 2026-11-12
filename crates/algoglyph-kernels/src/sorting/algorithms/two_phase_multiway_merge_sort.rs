//! Two-phase multiway merge sort, TPMMS (Garcia-Molina, Ullman and Widom, "Database
//! Systems: The Complete Book", 2nd ed., 2008, Pearson, section 15.4.1).
//!
//! Simulation of a memory of M items organised in blocks of B items, with the array as the
//! file on disk. Phase 1 fills the memory, sorts it and writes a sorted sublist, until the
//! file is consumed. Phase 2 merges all sublists in one pass: memory holds one input block
//! (buffer) per sublist and one output block; the smallest head among the buffers moves
//! to the output block, an empty input buffer is refilled with the next block of its
//! sublist, and a full output block is written to the file. The two phases suffice because
//! the number of sublists, about n / M, is below M / B. Here M = 2 ceil(sqrt n) (at least
//! 4) and B = max(1, M / (sublists + 1)). `aux` shows the buffers and the output block.
//! Ties go to the lower sublist, so the sort is stable. No simplification.
//!
//! Passes (`t.round()`): its two phases, each of which reads and writes every item once.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "two-phase-multiway-merge-sort",
    stable: Stability::Variant,
    in_place: false,
    kind: Kind::External,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if n < 2 {
        return Outcome::Sorted;
    }
    let m = 2 * memory_size(n);
    t.round();
    t.phase(&format!("phase 1: sort sublists of M = {m} items"));
    let lists = generate_runs(t, v, m);
    let b = (m / (lists.len() + 1)).max(1);
    show_tape(t, "sorted sublists on disk", &lists);
    if !t.ok() {
        return Outcome::Truncated;
    }
    t.round();
    t.phase(&format!(
        "phase 2: one {}-way merge with blocks of B = {b}",
        lists.len()
    ));
    let k = lists.len();
    let mut next_block = vec![0usize; k]; // next unread position of each sublist
    let mut buf: Vec<Vec<Item>> = vec![Vec::new(); k];
    let mut head = vec![0usize; k];
    for i in 0..k {
        refill(
            t,
            &lists[i],
            &mut buf[i],
            &mut head[i],
            &mut next_block[i],
            b,
            i,
        );
    }
    let mut out_block: Vec<Item> = Vec::with_capacity(b);
    let mut written = 0usize;
    loop {
        let mut best: Option<usize> = None;
        for i in 0..k {
            if head[i] >= buf[i].len() {
                continue;
            }
            best = match best {
                None => Some(i),
                Some(j) if t.cmp_items(&buf[i][head[i]], &buf[j][head[j]]) == Ordering::Less => {
                    Some(i)
                }
                keep => keep,
            };
        }
        let Some(i) = best else { break };
        out_block.push(buf[i][head[i]]);
        head[i] += 1;
        if head[i] == buf[i].len() {
            refill(
                t,
                &lists[i],
                &mut buf[i],
                &mut head[i],
                &mut next_block[i],
                b,
                i,
            );
        }
        if out_block.len() == b {
            flush(t, v, &mut out_block, &mut written);
            if !t.ok() {
                return Outcome::Truncated;
            }
        }
    }
    flush(t, v, &mut out_block, &mut written);
    t.aux_clear("sorted sublists on disk");
    Outcome::Sorted
}

/// Loads the next block of sublist `i` into its input buffer.
fn refill(
    t: &mut Tracer,
    list: &[Item],
    buf: &mut Vec<Item>,
    head: &mut usize,
    next: &mut usize,
    b: usize,
    i: usize,
) {
    let end = (*next + b).min(list.len());
    *buf = list[*next..end].to_vec();
    *head = 0;
    *next = end;
    t.aux(&format!("input buffer {i}"), buf);
}

fn flush(t: &mut Tracer, v: &mut [Item], out: &mut Vec<Item>, written: &mut usize) {
    t.aux("output block", out);
    for x in out.drain(..) {
        t.set(v, *written, x);
        *written += 1;
    }
    t.aux_clear("output block");
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

/// Run generation: reads the input in memory loads of `m`, sorts each load in memory and
/// writes it out as a run.
fn generate_runs(t: &mut Tracer, v: &[Item], m: usize) -> Vec<Vec<Item>> {
    let n = v.len();
    let mut runs = Vec::with_capacity(n.div_ceil(m));
    let mut start = 0;
    while start < n {
        let end = (start + m).min(n);
        t.mark(start, end, "memory load");
        let mut load: Vec<Item> = (start..end).map(|i| t.read(v, i)).collect();
        t.aux("memory", &load);
        mem_sort(t, &mut load);
        t.aux("memory", &load);
        runs.push(load);
        start = end;
    }
    t.aux_clear("memory");
    runs
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
