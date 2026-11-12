//! Pair Insertion Sort (Yaroslavskiy's insertion sort for the non-leftmost parts of Java 7's
//! `DualPivotQuicksort`, OpenJDK `java.util.DualPivotQuicksort.sort`): elements are inserted
//! two at a time. The pair is ordered first; the larger one is moved into place shifting
//! elements by two positions, then the smaller one continues from there shifting by one, so
//! the elements passed by both are moved once. The last element of an odd count is inserted
//! alone. The JDK version is unguarded (it relies on a smaller element left of the range);
//! here the scans are bounded. Not stable (an equal pair is inserted in reversed order), in
//! place.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "pair-insertion-sort",
    stable: Stability::No,
    in_place: true,
    kind: Kind::Comparison,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if n < 2 {
        return Outcome::Sorted;
    }
    let mut i = 1;
    while i + 1 < n {
        let mut a1 = t.read(v, i);
        let mut a2 = t.read(v, i + 1);
        if t.cmp_items(&a1, &a2) == Ordering::Less {
            core::mem::swap(&mut a1, &mut a2);
        }
        // a1 >= a2; shift by two past elements greater than a1
        let mut k = i as isize - 1;
        while k >= 0 && t.cmp_at(&a1, v, k as usize) == Ordering::Less {
            let y = v[k as usize];
            t.set(v, k as usize + 2, y);
            k -= 1;
        }
        t.set(v, (k + 2) as usize, a1);
        while k >= 0 && t.cmp_at(&a2, v, k as usize) == Ordering::Less {
            let y = v[k as usize];
            t.set(v, k as usize + 1, y);
            k -= 1;
        }
        t.set(v, (k + 1) as usize, a2);
        t.mark(0, i + 2, "sorted prefix");
        i += 2;
    }
    if i < n {
        let last = t.read(v, i);
        let mut k = i;
        while k > 0 && t.cmp_at(&last, v, k - 1) == Ordering::Less {
            let y = v[k - 1];
            t.set(v, k, y);
            k -= 1;
        }
        if k != i {
            t.set(v, k, last);
        }
    }
    Outcome::Sorted
}
