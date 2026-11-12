//! Buffer tree sort (Arge 1995, "The buffer tree: A new technique for optimal
//! I/O-algorithms", WADS 1995, LNCS 955, 334-345; journal version Arge 2003, Algorithmica
//! 37(1), 1-24).
//!
//! The documented strategy: insert every item into a buffer tree and read the leaves in
//! order. A buffer tree is an (a, b)-tree whose internal nodes carry a buffer of M items.
//! An insertion only appends to the root's buffer; when a buffer is full it is emptied:
//! its items are sorted in memory and passed to the children (an internal child's buffer,
//! or a leaf, which absorbs them by merging), recursively emptying any child buffer that
//! fills up, and splitting leaves and nodes that grow too large, so the tree is rebalanced
//! as in a B-tree. Work is done in batches of M, which gives O((n/B) log_{M/B}(n/B)) I/Os.
//! After the last insertion all buffers are emptied top-down and the leaves, in order, are
//! the sorted output. Here M = ceil(sqrt n) (at least 4), leaves hold up to 8 items and
//! nodes up to 4 children. `aux` shows the root buffer.
//! Simplification: an overfull node is split once, in half, when its buffer is emptied (it
//! may stay above the fan-out bound until it is emptied again), and the final emptying
//! outputs the leaves directly instead of restructuring the tree.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "buffer-tree-sort",
    stable: Stability::No,
    in_place: false,
    kind: Kind::External,
};

const FANOUT: usize = 4;
const LEAF: usize = 8;

enum Node {
    Leaf(Vec<Item>),
    Internal {
        split: Vec<Item>,
        kids: Vec<Node>,
        buf: Vec<Item>,
    },
}

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if n < 2 {
        return Outcome::Sorted;
    }
    let cap = memory_size(n);
    t.phase(&format!(
        "insert every item into the root buffer (M = {cap})"
    ));
    let mut root = Node::Internal {
        split: Vec::new(),
        kids: vec![Node::Leaf(Vec::new())],
        buf: Vec::new(),
    };
    for i in 0..n {
        let x = t.read(v, i);
        let full = match &mut root {
            Node::Internal { buf, .. } => {
                buf.push(x);
                t.aux("root buffer", buf);
                buf.len() >= cap
            }
            Node::Leaf(_) => unreachable!("the root is internal"),
        };
        if full {
            t.phase("root buffer full: empty it down the tree");
            if let Some((s, sib)) = empty(t, &mut root, cap) {
                let old = core::mem::replace(&mut root, Node::Leaf(Vec::new()));
                root = Node::Internal {
                    split: vec![s],
                    kids: vec![old, sib],
                    buf: Vec::new(),
                };
                t.phase("the root split: the tree grows by one level");
            }
            t.aux_clear("root buffer");
            if !t.ok() {
                return Outcome::Truncated;
            }
        }
    }
    t.phase("final emptying of all buffers; the leaves in order are the output");
    let mut out = Vec::with_capacity(n);
    collect(t, root, Vec::new(), &mut out);
    t.aux_clear("root buffer");
    write_out(t, v, &out);
    Outcome::Sorted
}

/// Child index of `x`: the number of splitters <= x.
fn route(t: &mut Tracer, split: &[Item], x: &Item) -> usize {
    let (mut lo, mut hi) = (0usize, split.len());
    while lo < hi {
        let mid = lo + (hi - lo) / 2;
        if t.cmp_items(x, &split[mid]) == Ordering::Less {
            hi = mid;
        } else {
            lo = mid + 1;
        }
    }
    lo
}

fn merge2(t: &mut Tracer, a: Vec<Item>, b: Vec<Item>) -> Vec<Item> {
    kway_merge(t, &[a, b])
}

/// Empties the buffer of an internal node; returns a new right sibling when it splits.
fn empty(t: &mut Tracer, node: &mut Node, cap: usize) -> Option<(Item, Node)> {
    let Node::Internal { split, kids, buf } = node else {
        return None;
    };
    let mut items = core::mem::take(buf);
    mem_sort(t, &mut items);
    let mut parts: Vec<Vec<Item>> = vec![Vec::new(); kids.len()];
    for x in items {
        let i = route(t, split, &x);
        parts[i].push(x);
    }
    let old_kids = core::mem::take(kids);
    let old_split = core::mem::take(split);
    for (i, (mut kid, part)) in old_kids.into_iter().zip(parts).enumerate() {
        if i > 0 {
            split.push(old_split[i - 1]);
        }
        match kid {
            Node::Leaf(leaf) => {
                let merged = if part.is_empty() {
                    leaf
                } else {
                    merge2(t, leaf, part)
                };
                if merged.len() > LEAF {
                    let chunks = merged.len().div_ceil(LEAF);
                    let size = merged.len().div_ceil(chunks);
                    for (j, c) in merged.chunks(size).enumerate() {
                        if j > 0 {
                            split.push(c[0]);
                        }
                        kids.push(Node::Leaf(c.to_vec()));
                    }
                } else {
                    kids.push(Node::Leaf(merged));
                }
            }
            Node::Internal { .. } => {
                let full = if let Node::Internal { buf, .. } = &mut kid {
                    buf.extend(part);
                    buf.len() >= cap
                } else {
                    false
                };
                if full {
                    if let Some((s, sib)) = empty(t, &mut kid, cap) {
                        kids.push(kid);
                        split.push(s);
                        kids.push(sib);
                        continue;
                    }
                }
                kids.push(kid);
            }
        }
    }
    if kids.len() > FANOUT {
        let h = kids.len() / 2;
        let right_kids = kids.split_off(h);
        let right_split = split.split_off(h);
        let promoted = split.pop().expect("a separator between the halves");
        return Some((
            promoted,
            Node::Internal {
                split: right_split,
                kids: right_kids,
                buf: Vec::new(),
            },
        ));
    }
    None
}

/// Final emptying: pushes `pending` and every buffer down and appends the leaves in order.
fn collect(t: &mut Tracer, node: Node, pending: Vec<Item>, out: &mut Vec<Item>) {
    match node {
        Node::Leaf(leaf) => {
            let merged = if pending.is_empty() {
                leaf
            } else {
                merge2(t, leaf, pending)
            };
            out.extend(merged);
        }
        Node::Internal {
            split,
            kids,
            mut buf,
        } => {
            buf.extend(pending);
            mem_sort(t, &mut buf);
            let mut parts: Vec<Vec<Item>> = vec![Vec::new(); kids.len()];
            for x in buf {
                let i = route(t, &split, &x);
                parts[i].push(x);
            }
            for (kid, part) in kids.into_iter().zip(parts) {
                collect(t, kid, part, out);
            }
        }
    }
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
