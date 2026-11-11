//! Funnelsort (Frigo, Leiserson, Prokop and Ramachandran 1999, "Cache-oblivious
//! algorithms", FOCS 1999, 285-297), in the lazy form of Brodal and Fagerberg 2002,
//! "Cache oblivious distribution sweeping", ICALP 2002, LNCS 2380, 426-438.
//!
//! The documented strategy: split the input into k = ceil(n^(1/3)) segments of about
//! n^(2/3) items, sort every segment recursively, and merge the k sorted segments with a
//! k-funnel. A k-funnel is a binary tree of mergers with a buffer on every edge; a node
//! whose subtree has l leaves owns a buffer of ceil(l^(3/2)) items. Filling a node merges
//! the heads of its two children into its buffer until the buffer is full or both
//! children are exhausted, refilling a child (recursively) whenever its buffer runs empty;
//! the root's buffer is the output. The buffer sizes are what makes the algorithm
//! cache-oblivious: they keep each sub-funnel's working set contiguous at every scale.
//! Segments of at most 8 items are sorted by insertion sort. `aux` shows the buffers.
//! Ties go to the left child, so this simulation happens to be stable; funnelsort is not
//! specified as stable and META declares it unstable. The memory layout (van Emde Boas
//! order of the buffers) that gives the cache bounds is not represented.
use crate::sorting::prelude::*;
use std::collections::VecDeque;

pub const META: Meta = Meta {
    id: "funnel-sort",
    stable: Stability::No,
    in_place: false,
    kind: Kind::External,
};

#[derive(Clone, Copy)]
enum Child {
    Leaf(usize),
    Node(usize),
}

struct Node {
    left: Child,
    right: Child,
    buf: VecDeque<Item>,
    cap: usize,
    done: bool,
}

struct Funnel {
    nodes: Vec<Node>,
    leaves: Vec<VecDeque<Item>>,
}

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if funnelsort(t, v, 0, n, 0) {
        Outcome::Sorted
    } else {
        Outcome::Truncated
    }
}

fn funnelsort(t: &mut Tracer, v: &mut [Item], lo: usize, hi: usize, depth: usize) -> bool {
    if !t.ok() {
        return false;
    }
    let n = hi - lo;
    if n <= 8 {
        for i in lo + 1..hi {
            let mut j = i;
            while j > lo && t.cmp(v, j - 1, j) == Ordering::Greater {
                t.swap(v, j - 1, j);
                j -= 1;
            }
        }
        return true;
    }
    let mut k = 2usize;
    while k * k * k < n {
        k += 1;
    }
    let seg = n.div_ceil(k);
    let bounds: Vec<(usize, usize)> = (0..k)
        .map(|i| (lo + (i * seg).min(n), lo + ((i + 1) * seg).min(n)))
        .filter(|(a, b)| a < b)
        .collect();
    for &(a, b) in &bounds {
        if !funnelsort(t, v, a, b, depth + 1) {
            return false;
        }
    }
    t.phase(&format!(
        "depth {depth}: merge {} sorted segments with a {}-funnel",
        bounds.len(),
        bounds.len()
    ));
    t.mark(lo, hi, "funnel merge");
    let leaves: Vec<VecDeque<Item>> = bounds
        .iter()
        .map(|&(a, b)| (a..b).map(|i| t.read(v, i)).collect())
        .collect();
    let mut f = Funnel {
        nodes: Vec::new(),
        leaves,
    };
    let root = build(&mut f, 0, bounds.len());
    let root = match root {
        Child::Node(r) => r,
        Child::Leaf(_) => return true,
    };
    f.nodes[root].cap = n;
    fill(t, &mut f, root);
    let out: Vec<Item> = f.nodes[root].buf.drain(..).collect();
    for (i, x) in out.into_iter().enumerate() {
        t.set(v, lo + i, x);
    }
    for id in 0..f.nodes.len() {
        t.aux_clear(&format!("funnel buffer {id}"));
    }
    true
}

fn build(f: &mut Funnel, a: usize, b: usize) -> Child {
    if b - a == 1 {
        return Child::Leaf(a);
    }
    let mid = a + (b - a) / 2;
    let left = build(f, a, mid);
    let right = build(f, mid, b);
    let l = (b - a) as f64;
    let cap = (l * l.sqrt()).ceil() as usize;
    f.nodes.push(Node {
        left,
        right,
        buf: VecDeque::new(),
        cap,
        done: false,
    });
    Child::Node(f.nodes.len() - 1)
}

fn head(f: &Funnel, c: Child) -> Option<Item> {
    match c {
        Child::Leaf(i) => f.leaves[i].front().copied(),
        Child::Node(i) => f.nodes[i].buf.front().copied(),
    }
}

fn pop(f: &mut Funnel, c: Child) -> Item {
    match c {
        Child::Leaf(i) => f.leaves[i].pop_front(),
        Child::Node(i) => f.nodes[i].buf.pop_front(),
    }
    .expect("child has an item")
}

fn fill(t: &mut Tracer, f: &mut Funnel, id: usize) {
    let (left, right) = (f.nodes[id].left, f.nodes[id].right);
    while f.nodes[id].buf.len() < f.nodes[id].cap {
        for c in [left, right] {
            if let Child::Node(ci) = c {
                if f.nodes[ci].buf.is_empty() && !f.nodes[ci].done {
                    fill(t, f, ci);
                }
            }
        }
        let take_right = match (head(f, left), head(f, right)) {
            (Some(a), Some(b)) => t.cmp_items(&b, &a) == Ordering::Less,
            (Some(_), None) => false,
            (None, Some(_)) => true,
            (None, None) => {
                f.nodes[id].done = true;
                break;
            }
        };
        let x = pop(f, if take_right { right } else { left });
        f.nodes[id].buf.push_back(x);
    }
    let snapshot: Vec<Item> = f.nodes[id].buf.iter().copied().collect();
    t.aux(&format!("funnel buffer {id}"), &snapshot);
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
