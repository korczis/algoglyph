//! Topological sort, Kahn's algorithm (Kahn 1962, "Topological sorting of large networks",
//! Communications of the ACM 5(11), 558-562; Knuth, TAOCP Vol. 1, 3rd ed., 2.2.3,
//! Algorithm T).
//!
//! Input: the items are the vertices (vertex i = input position i) and `options.edges`
//! lists the arcs (u, v) meaning "u must come before v"; arcs that name a missing vertex
//! or a loop are ignored. Kahn's algorithm counts the in-degree of every vertex, puts the
//! vertices of in-degree 0 into a ready set, and repeatedly outputs a ready vertex and
//! removes its outgoing arcs, which may make further vertices ready. The ready set is a
//! priority queue ordered by key (then by position): among the vertices that may come next,
//! the one with the smallest key goes first, so the output is the lexicographically
//! smallest topological order, and with no arcs it is simply the input sorted by key
//! (stably). `aux` shows the ready set, the output is written left to right. If the graph
//! has a cycle, the vertices on or behind it never become ready: the result is
//! `NotASort("the graph has a cycle")` with the vertices that could not be placed left in
//! input order after the placed ones.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "topological-sort",
    stable: Stability::No,
    in_place: false,
    kind: Kind::Special,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, opt: &Options) -> Outcome {
    let n = v.len();
    let items: Vec<Item> = (0..n).map(|i| t.read(v, i)).collect();
    let mut out_arcs: Vec<Vec<usize>> = vec![Vec::new(); n];
    let mut indeg = vec![0usize; n];
    t.phase(&format!("count in-degrees over {} arcs", opt.edges.len()));
    for &(a, b) in &opt.edges {
        let (a, b) = (a as usize, b as usize);
        if a < n && b < n && a != b {
            out_arcs[a].push(b);
            indeg[b] += 1;
        }
    }
    // ready set: min-heap of vertex ids by (key, id)
    let mut heap: Vec<usize> = Vec::new();
    for i in 0..n {
        if indeg[i] == 0 {
            push(t, &items, &mut heap, i);
        }
    }
    show(t, &items, &heap);
    let mut placed = vec![false; n];
    let mut pos = 0;
    t.phase("Kahn: output the smallest ready vertex, release its successors");
    while let Some(u) = pop(t, &items, &mut heap) {
        t.set(v, pos, items[u]);
        placed[u] = true;
        pos += 1;
        for &w in &out_arcs[u] {
            indeg[w] -= 1;
            if indeg[w] == 0 {
                push(t, &items, &mut heap, w);
            }
        }
        show(t, &items, &heap);
        if !t.ok() {
            return Outcome::Truncated;
        }
    }
    t.aux_clear("ready");
    if pos < n {
        for (i, x) in items.iter().enumerate() {
            if !placed[i] {
                t.set(v, pos, *x);
                pos += 1;
            }
        }
        return Outcome::NotASort("the graph has a cycle");
    }
    Outcome::Sorted
}

fn before(t: &mut Tracer, items: &[Item], a: usize, b: usize) -> bool {
    match t.cmp_items(&items[a], &items[b]) {
        Ordering::Less => true,
        Ordering::Greater => false,
        Ordering::Equal => a < b,
    }
}

fn push(t: &mut Tracer, items: &[Item], h: &mut Vec<usize>, x: usize) {
    h.push(x);
    let mut i = h.len() - 1;
    while i > 0 {
        let p = (i - 1) / 2;
        if before(t, items, h[i], h[p]) {
            h.swap(i, p);
            i = p;
        } else {
            break;
        }
    }
}

fn pop(t: &mut Tracer, items: &[Item], h: &mut Vec<usize>) -> Option<usize> {
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
        if l < n && before(t, items, h[l], h[s]) {
            s = l;
        }
        if r < n && before(t, items, h[r], h[s]) {
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

fn show(t: &mut Tracer, items: &[Item], h: &[usize]) {
    let ready: Vec<Item> = h.iter().map(|&i| items[i]).collect();
    t.aux("ready", &ready);
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
    fn respects_edges_and_reports_cycles() {
        let input = keyed([1, 2, 3]);
        let opt = Options {
            edges: vec![(2, 0)],
            ..count_only()
        };
        let (out, o, _) = run(&input, &opt);
        assert_eq!(o, Outcome::Sorted);
        assert_eq!(out.iter().map(|x| x.tag).collect::<Vec<_>>(), vec![1, 2, 0]);
        let opt = Options {
            edges: vec![(0, 1), (1, 0)],
            ..count_only()
        };
        let (out, o, _) = run(&input, &opt);
        assert_eq!(o, Outcome::NotASort("the graph has a cycle"));
        assert_eq!(out.len(), 3);
        // a random DAG: every arc goes from a smaller to a larger index
        let mut r = SplitMix64::new(8);
        let input = random(200, 0, 50, &mut r);
        let edges: Vec<(u32, u32)> = (0..400)
            .map(|_| {
                let a = r.below(199) as u32;
                (a, a + 1 + r.below(199 - a as u64) as u32)
            })
            .collect();
        let opt = Options {
            edges: edges.clone(),
            ..count_only()
        };
        let (out, o, _) = run(&input, &opt);
        assert_eq!(o, Outcome::Sorted);
        let mut pos = vec![0usize; 200];
        for (p, x) in out.iter().enumerate() {
            pos[x.tag as usize] = p;
        }
        for (a, b) in edges {
            assert!(pos[a as usize] < pos[b as usize], "arc ({a}, {b}) violated");
        }
    }
}
