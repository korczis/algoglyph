//! Weak-Heapsort (Dutton 1993, "Weak-heap sort", BIT 33(3); analysed by Edelkamp & Wegener
//! 2000). A weak heap relaxes the heap order: every element is >= the elements of its right
//! subtree only, the root has no left subtree, and one "reverse bit" per node swaps the
//! roles of its children. `join` compares an element with its distinguished ancestor and,
//! when it is larger, exchanges them and flips its reverse bit. Building takes n - 1
//! comparisons, sorting at most n log n + 0.1 n. The n reverse bits are the auxiliary
//! structure (aux `reverse bits`, keys 0/1), so this is not in place in the strict sense.
//! Not stable.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "weak-heapsort",
    stable: Stability::No,
    in_place: false,
    kind: Kind::Comparison,
};

fn bits_aux(t: &mut Tracer, r: &[bool]) {
    let items: Vec<Item> = r.iter().map(|&b| Item::new(b as i32, 0)).collect();
    t.aux("reverse bits", &items);
}

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if n < 2 {
        return Outcome::Sorted;
    }
    let mut r = vec![false; n];
    bits_aux(t, &r);
    t.phase("build weak heap");
    for j in (1..n).rev() {
        let i = d_ancestor(j, &r);
        join(t, v, &mut r, i, j);
    }
    bits_aux(t, &r);
    t.phase("extract maxima");
    for m in (2..n).rev() {
        t.swap(v, 0, m);
        // descend along left children of the root's right child
        let mut x = 1;
        loop {
            let y = 2 * x + r[x] as usize;
            if y >= m {
                break;
            }
            x = y;
        }
        while x > 0 {
            join(t, v, &mut r, 0, x);
            x >>= 1;
        }
        t.mark(m, n, "sorted");
    }
    t.swap(v, 0, 1);
    bits_aux(t, &r);
    t.aux_clear("reverse bits");
    Outcome::Sorted
}

/// The distinguished ancestor of j: climb while j is a left child.
fn d_ancestor(mut j: usize, r: &[bool]) -> usize {
    while (j & 1) == r[j >> 1] as usize {
        j >>= 1;
    }
    j >> 1
}

fn join(t: &mut Tracer, v: &mut [Item], r: &mut [bool], i: usize, j: usize) {
    if t.cmp(v, j, i) == Ordering::Greater {
        t.swap(v, i, j);
        r[j] = !r[j];
    }
}
