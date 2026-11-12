//! Library Sort / gapped insertion sort (Bender, Farach-Colton & Mosteiro 2006, "Insertion
//! sort is O(n log n)", Theory of Computing Systems 39(3)). The elements are inserted into a
//! gapped array (aux `shelf`, (1 + ε) n cells with ε = 1) like books on a library shelf that
//! leaves space: the position comes from a binary search over the occupied cells, and an
//! insertion only shifts elements up to the nearest gap. After 2^i insertions the shelf is
//! rebalanced, spreading the elements evenly with a gap after each. Ties are inserted after
//! equal keys. Simplified: the paper inserts in random order to get its high-probability
//! bound, which makes it unstable; this inserts in input order (deterministic, and in fact
//! order-preserving on equal keys, but declared not stable like the published algorithm).
//! Not in place.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "library-sort",
    stable: Stability::No,
    in_place: false,
    kind: Kind::Comparison,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if n < 2 {
        return Outcome::Sorted;
    }
    let cap = 2 * n + 2;
    let mut shelf: Vec<Option<Item>> = vec![None; cap];
    let mut end = 0usize; // one past the last occupied cell
    let mut count = 0usize;
    let mut next_rebalance = 1usize;
    for i in 0..n {
        if count == next_rebalance {
            t.phase(&format!("rebalance {count} elements"));
            end = rebalance(&mut shelf, count);
            next_rebalance *= 2;
            snapshot(t, &shelf, end);
        }
        let x = t.read(v, i);
        let pos = search(t, &shelf, end, &x);
        end = insert(&mut shelf, pos, end, x);
        count += 1;
        snapshot(t, &shelf, end);
    }
    let mut k = 0;
    for cell in shelf.iter().take(end).flatten() {
        t.set(v, k, *cell);
        k += 1;
    }
    t.aux_clear("shelf");
    Outcome::Sorted
}

/// The shelf as laid out, gaps included: an insertion writes only the cells it shifts.
fn snapshot(t: &mut Tracer, shelf: &[Option<Item>], end: usize) {
    t.aux_cells("shelf", &shelf[..end]);
}

/// Spreads the `count` elements so that element j sits at cell 2j + 1.
fn rebalance(shelf: &mut [Option<Item>], count: usize) -> usize {
    let items: Vec<Item> = shelf.iter().flatten().copied().collect();
    debug_assert_eq!(items.len(), count);
    shelf.iter_mut().for_each(|c| *c = None);
    for (j, x) in items.iter().enumerate() {
        shelf[2 * j + 1] = Some(*x);
    }
    2 * count
}

/// The cell before which `x` goes: all occupied cells left of it are <= x, all right are > x.
fn search(t: &mut Tracer, shelf: &[Option<Item>], end: usize, x: &Item) -> usize {
    let (mut lo, mut hi) = (0usize, end);
    while lo < hi {
        let mid = lo + (hi - lo) / 2;
        let mut p = mid;
        while p < hi && shelf[p].is_none() {
            p += 1;
        }
        if p == hi {
            hi = mid;
            continue;
        }
        let y = shelf[p].unwrap();
        if t.cmp_items(x, &y) == Ordering::Less {
            hi = mid;
        } else {
            lo = p + 1;
        }
    }
    lo
}

/// Inserts `x` at cell `pos`, shifting to the nearest gap; returns the new end.
fn insert(shelf: &mut [Option<Item>], pos: usize, end: usize, x: Item) -> usize {
    if pos < shelf.len() && shelf[pos].is_none() {
        shelf[pos] = Some(x);
        return end.max(pos + 1);
    }
    // nearest gap to the right
    let mut r = pos;
    while r < shelf.len() && shelf[r].is_some() {
        r += 1;
    }
    if r < shelf.len() {
        for k in (pos..r).rev() {
            shelf[k + 1] = shelf[k];
        }
        shelf[pos] = Some(x);
        return end.max(r + 1);
    }
    // otherwise to the left: shift [l+1, pos) one cell left and put x at pos - 1
    let mut l = pos - 1;
    while shelf[l].is_some() {
        l -= 1;
    }
    for k in (l + 1)..pos {
        shelf[k - 1] = shelf[k];
    }
    shelf[pos - 1] = Some(x);
    end
}
