//! Bottom-Up Merge Sort (Knuth 1998, TAOCP 3, §5.2.4, "straight two-way merge", Algorithm S;
//! Sedgewick & Wayne 2011, §2.2 `MergeBU`): no recursion; passes merge adjacent runs of
//! width 1, 2, 4, … until one run remains, through an auxiliary array of n elements (aux
//! `aux`, shown as laid out: each merge's range copied in at its own cells, released once
//! merged back). Stable, not in place, Θ(n log n) on every input.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "bottom-up-merge-sort",
    stable: Stability::Yes,
    in_place: false,
    kind: Kind::Comparison,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if n < 2 {
        return Outcome::Sorted;
    }
    let mut aux = vec![Item::default(); n];
    let mut width = 1;
    while width < n {
        t.phase(&format!("merge runs of width {width}"));
        let mut lo = 0;
        while lo + width < n {
            let mid = lo + width;
            let hi = (lo + 2 * width).min(n);
            t.mark(lo, hi, "merge");
            for k in lo..hi {
                aux[k] = t.read(v, k);
            }
            // the buffer as laid out: this merge's range copied in, the rest of it dead
            let cells: Vec<Option<Item>> = (0..n)
                .map(|k| (lo..hi).contains(&k).then(|| aux[k]))
                .collect();
            t.aux_cells("aux", &cells);
            let (mut i, mut j) = (lo, mid);
            for k in lo..hi {
                if i >= mid {
                    t.set(v, k, aux[j]);
                    j += 1;
                } else if j >= hi || t.cmp_items(&aux[i], &aux[j]) != Ordering::Greater {
                    t.set(v, k, aux[i]);
                    i += 1;
                } else {
                    t.set(v, k, aux[j]);
                    j += 1;
                }
            }
            // merged back: the copy is dead, and the next merge copies its range in anew
            t.aux_clear("aux");
            lo += 2 * width;
        }
        width *= 2;
    }
    Outcome::Sorted
}
