//! Patience Sorting (Mallows 1963, after the card game; Aldous & Diaconis 1999, "Longest
//! increasing subsequences: from patience sorting to the Baik-Deift-Johansson theorem",
//! Bulletin of the AMS 36(4)). Dealing: each element goes on the leftmost pile whose top is
//! greater than it (binary search over the tops, which are non-decreasing), or starts a new
//! pile; the number of piles is the length of the longest non-decreasing subsequence.
//! Collecting: a min-heap of the pile tops (ties by pile index) outputs the elements in
//! order. Equal keys land on increasing pile indices, so this formulation keeps equal keys
//! in order, although patience sorting is not generally listed as stable. Piles are aux
//! `pile i`. Not in place.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "patience-sorting",
    stable: Stability::No,
    in_place: false,
    kind: Kind::Comparison,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if n < 2 {
        return Outcome::Sorted;
    }
    let mut piles: Vec<Vec<Item>> = Vec::new();
    t.phase("deal onto piles");
    for i in 0..n {
        let x = t.read(v, i);
        // leftmost pile whose top is > x
        let (mut lo, mut hi) = (0usize, piles.len());
        while lo < hi {
            let mid = lo + (hi - lo) / 2;
            let top = *piles[mid].last().unwrap();
            if t.cmp_items(&top, &x) == Ordering::Greater {
                hi = mid;
            } else {
                lo = mid + 1;
            }
        }
        if lo == piles.len() {
            piles.push(Vec::new());
        }
        piles[lo].push(x);
        let name = format!("pile {lo}");
        t.aux(&name, &piles[lo]);
    }
    t.phase(&format!("collect from {} piles", piles.len()));
    // heap of pile indices ordered by (top key, pile index)
    let mut heap: Vec<usize> = Vec::new();
    for p in 0..piles.len() {
        heap_push(t, &piles, &mut heap, p);
    }
    for k in 0..n {
        let p = heap_pop(t, &piles, &mut heap);
        let x = piles[p].pop().unwrap();
        t.set(v, k, x);
        let name = format!("pile {p}");
        t.aux(&name, &piles[p]);
        if !piles[p].is_empty() {
            heap_push(t, &piles, &mut heap, p);
        }
    }
    Outcome::Sorted
}

fn before(t: &mut Tracer, piles: &[Vec<Item>], a: usize, b: usize) -> bool {
    match t.cmp_items(piles[a].last().unwrap(), piles[b].last().unwrap()) {
        Ordering::Less => true,
        Ordering::Greater => false,
        Ordering::Equal => a < b,
    }
}

fn heap_push(t: &mut Tracer, piles: &[Vec<Item>], heap: &mut Vec<usize>, p: usize) {
    heap.push(p);
    let mut i = heap.len() - 1;
    while i > 0 {
        let par = (i - 1) / 2;
        if before(t, piles, heap[i], heap[par]) {
            heap.swap(i, par);
            i = par;
        } else {
            break;
        }
    }
}

fn heap_pop(t: &mut Tracer, piles: &[Vec<Item>], heap: &mut Vec<usize>) -> usize {
    let top = heap[0];
    let last = heap.pop().unwrap();
    if !heap.is_empty() {
        heap[0] = last;
        let mut i = 0;
        loop {
            let l = 2 * i + 1;
            if l >= heap.len() {
                break;
            }
            let r = l + 1;
            let c = if r < heap.len() && before(t, piles, heap[r], heap[l]) {
                r
            } else {
                l
            };
            if before(t, piles, heap[c], heap[i]) {
                heap.swap(i, c);
                i = c;
            } else {
                break;
            }
        }
    }
    top
}
