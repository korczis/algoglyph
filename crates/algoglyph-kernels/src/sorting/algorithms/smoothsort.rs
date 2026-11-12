//! Smoothsort (Dijkstra 1981, EWD796a "Smoothsort, an alternative for sorting in situ";
//! Science of Computer Programming 1(3), 1982). The array is kept as a sequence of Leonardo
//! heaps (sizes L(k) = L(k-1) + L(k-2) + 1: 1, 1, 3, 5, 9, 15, …) whose roots ascend from
//! left to right. Growing: a new element either fuses the last two heaps of orders k+1 and k
//! into one of order k+2, or starts a heap of order 1 or 0; then it is "trinkled" to its
//! place among the roots and sifted into its heap. Shrinking: removing the last root splits
//! its heap into its two children, whose roots are trinkled in turn. O(n) on sorted input,
//! O(n log n) worst case.
//!
//! Simplified: the stack of heap orders is an explicit list (O(log n) small integers) instead
//! of Dijkstra's bit-vector encoding, and every new root is fully trinkled (Dijkstra uses a
//! cheaper "semitrinkle" when the heap will be fused later; same result, more comparisons).
//! Not stable, in place.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "smoothsort",
    stable: Stability::No,
    in_place: true,
    kind: Kind::Comparison,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if n < 2 {
        return Outcome::Sorted;
    }
    // Leonardo numbers L(0) = L(1) = 1, L(k) = L(k-1) + L(k-2) + 1
    let mut lp = vec![1usize, 1];
    while *lp.last().unwrap() < n {
        let k = lp.len();
        lp.push(lp[k - 1] + lp[k - 2] + 1);
    }
    let mut orders: Vec<usize> = Vec::new();
    t.phase("build the Leonardo heaps");
    for i in 0..n {
        let len = orders.len();
        if len >= 2 && orders[len - 2] == orders[len - 1] + 1 {
            let k = orders[len - 2];
            orders.pop();
            orders.pop();
            orders.push(k + 1);
        } else if len >= 1 && orders[len - 1] == 1 {
            orders.push(0);
        } else {
            orders.push(1);
        }
        trinkle(t, v, &lp, &orders, orders.len() - 1, i);
    }
    t.phase("dequeue the maxima");
    for i in (0..n).rev() {
        let k = orders.pop().unwrap();
        if k >= 2 {
            let right = i - 1;
            let left = i - 1 - lp[k - 2];
            orders.push(k - 1);
            trinkle(t, v, &lp, &orders, orders.len() - 1, left);
            orders.push(k - 2);
            trinkle(t, v, &lp, &orders, orders.len() - 1, right);
        }
        t.mark(i, n, "sorted");
    }
    Outcome::Sorted
}

/// Moves the root at `root` (heap number `s` in `orders`) left along the roots while the
/// previous root is larger than it and than both its children, then sifts it down.
fn trinkle(
    t: &mut Tracer,
    v: &mut [Item],
    lp: &[usize],
    orders: &[usize],
    mut s: usize,
    mut root: usize,
) {
    while s > 0 {
        let k = orders[s];
        let prev = root - lp[k];
        if t.cmp(v, prev, root) != Ordering::Greater {
            break;
        }
        if k >= 2 {
            let r = root - 1;
            let l = root - 1 - lp[k - 2];
            if t.cmp(v, prev, r) != Ordering::Greater || t.cmp(v, prev, l) != Ordering::Greater {
                break;
            }
        }
        t.swap(v, prev, root);
        root = prev;
        s -= 1;
    }
    sift(t, v, lp, root, orders[s]);
}

fn sift(t: &mut Tracer, v: &mut [Item], lp: &[usize], mut root: usize, mut k: usize) {
    while k >= 2 {
        let r = root - 1;
        let l = root - 1 - lp[k - 2];
        let (c, ck) = if t.cmp(v, l, r) == Ordering::Greater {
            (l, k - 1)
        } else {
            (r, k - 2)
        };
        if t.cmp(v, root, c) != Ordering::Less {
            break;
        }
        t.swap(v, root, c);
        root = c;
        k = ck;
    }
}
