//! Bottom-Up Heapsort (Wegener 1993, "BOTTOM-UP-HEAPSORT, a new variant of HEAPSORT beating,
//! on an average, QUICKSORT (if n is not very small)", Theoretical Computer Science 118(1)).
//! After the root is exchanged with the last heap element, the "special path" of larger
//! children is followed down to a leaf with one comparison per level; the new root's place
//! is then found by climbing back up that path, and the path is shifted. This needs about
//! n log n + O(n) comparisons instead of 2 n log n. The heap is built with the same
//! reheap procedure (Floyd's order). Not stable, in place.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "bottom-up-heapsort",
    stable: Stability::No,
    in_place: true,
    kind: Kind::Comparison,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if n < 2 {
        return Outcome::Sorted;
    }
    t.phase("build heap");
    for root in (0..n / 2).rev() {
        reheap(t, v, root, n);
    }
    t.phase("extract maxima");
    for end in (1..n).rev() {
        t.swap(v, 0, end);
        reheap(t, v, 0, end);
        t.mark(end, n, "sorted");
    }
    Outcome::Sorted
}

/// Wegener's reheap of the subtree at `root` within the heap `[0, n)`.
fn reheap(t: &mut Tracer, v: &mut [Item], root: usize, n: usize) {
    // leaf search: follow the larger child down to a leaf
    let mut j = root;
    loop {
        let l = 2 * j + 1;
        if l >= n {
            break;
        }
        j = if l + 1 < n && t.cmp(v, l + 1, l) == Ordering::Greater {
            l + 1
        } else {
            l
        };
    }
    // bottom-up search: climb until an element >= the root value
    let x = t.read(v, root);
    while j != root && t.cmp_at(&x, v, j) == Ordering::Greater {
        j = (j - 1) / 2;
    }
    // interchange: shift the path between root and j up by one level, put x at j
    let mut carry = t.read(v, j);
    t.set(v, j, x);
    while j != root {
        j = (j - 1) / 2;
        let next = t.read(v, j);
        t.set(v, j, carry);
        carry = next;
    }
}
