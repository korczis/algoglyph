//! Double Selection Sort (bidirectional selection sort; Knuth 1998, §5.2.3, exercise 5.2.3-2
//! discusses finding minimum and maximum together): each pass over the unsorted middle finds
//! both its minimum and its maximum and moves them to the two ends, halving the number of
//! passes. Not stable, in place.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "double-selection-sort",
    stable: Stability::No,
    in_place: true,
    kind: Kind::Comparison,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if n < 2 {
        return Outcome::Sorted;
    }
    let (mut lo, mut hi) = (0usize, n - 1);
    while lo < hi {
        let (mut mn, mut mx) = (lo, lo);
        for j in (lo + 1)..=hi {
            if t.cmp(v, j, mn) == Ordering::Less {
                mn = j;
            } else if t.cmp(v, j, mx) != Ordering::Less {
                mx = j;
            }
        }
        if mn != lo {
            t.swap(v, lo, mn);
        }
        // the maximum may have been the element just moved away from lo
        if mx == lo {
            mx = mn;
        }
        if mx != hi {
            t.swap(v, hi, mx);
        }
        t.mark(0, lo + 1, "sorted low");
        t.mark(hi, n, "sorted high");
        lo += 1;
        hi -= 1;
    }
    Outcome::Sorted
}
