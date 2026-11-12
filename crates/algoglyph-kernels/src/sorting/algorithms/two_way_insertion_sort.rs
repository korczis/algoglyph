//! Two-Way Insertion Sort (Knuth 1998, TAOCP 3, §5.2.1, "two-way insertion"): the output
//! area (aux `output`, 2n + 1 cells) starts with the first element in its middle; each new
//! element is placed by shifting whichever side of its position (left or right) is shorter,
//! so the sorted block grows in both directions and the average number of moves is about
//! halved compared with straight insertion. Positions are found by binary search after equal
//! keys, so it is stable. The result is copied back. Not in place.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "two-way-insertion-sort",
    stable: Stability::Variant,
    in_place: false,
    kind: Kind::Comparison,
};

/// The output buffer as laid out, the occupied range `[lo, hi)` in its own cells: a shift
/// writes the cells it moves, and growing at either end writes one.
fn show(t: &mut Tracer, out: &[Item], lo: usize, hi: usize) {
    let cells: Vec<Option<Item>> = (0..out.len())
        .map(|k| (lo..hi).contains(&k).then(|| out[k]))
        .collect();
    t.aux_cells("output", &cells);
}

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if n < 2 {
        return Outcome::Sorted;
    }
    let mut out = vec![Item::default(); 2 * n + 1];
    let (mut lo, mut hi) = (n, n + 1); // occupied [lo, hi)
    out[n] = t.read(v, 0);
    show(t, &out, lo, hi);
    for i in 1..n {
        let x = t.read(v, i);
        // upper bound of x in out[lo..hi]
        let (mut a, mut b) = (lo, hi);
        while a < b {
            let m = a + (b - a) / 2;
            if t.cmp_items(&x, &out[m]) == Ordering::Less {
                b = m;
            } else {
                a = m + 1;
            }
        }
        let pos = a;
        if pos - lo < hi - pos {
            // shift [lo, pos) one cell left
            for k in lo..pos {
                out[k - 1] = out[k];
            }
            lo -= 1;
            out[pos - 1] = x;
        } else {
            for k in (pos..hi).rev() {
                out[k + 1] = out[k];
            }
            hi += 1;
            out[pos] = x;
        }
        show(t, &out, lo, hi);
    }
    for k in 0..n {
        t.set(v, k, out[lo + k]);
    }
    t.aux_clear("output");
    Outcome::Sorted
}
