//! Strand Sort (a list-merging sort; the name and the formulation used here are those of the
//! common textbook and Rosetta Code descriptions, its first publication is not established):
//! repeatedly pull a "strand" out of the remaining input, taking the first element and then
//! every later element that is >= the last one taken, and merge the strand into the sorted
//! result. O(n√n) on random inputs, O(n) on sorted input, O(n^2) on reversed input. The
//! remaining input, the strand and the result are aux structures. Ties in the merge favour
//! the result (earlier strands), which keeps it stable. Not in place.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "strand-sort",
    stable: Stability::Yes,
    in_place: false,
    kind: Kind::Comparison,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if n < 2 {
        return Outcome::Sorted;
    }
    let mut rest: Vec<Item> = (0..n).map(|i| t.read(v, i)).collect();
    t.aux("input", &rest);
    let mut result: Vec<Item> = Vec::with_capacity(n);
    let mut strands = 0;
    while !rest.is_empty() {
        strands += 1;
        t.phase(&format!("strand {strands}"));
        let mut strand = vec![rest[0]];
        let mut left = Vec::with_capacity(rest.len());
        for x in rest.iter().skip(1) {
            if t.cmp_items(x, strand.last().unwrap()) != Ordering::Less {
                strand.push(*x);
            } else {
                left.push(*x);
            }
        }
        rest = left;
        t.aux("input", &rest);
        t.aux("strand", &strand);
        // merge strand into result
        let mut merged = Vec::with_capacity(result.len() + strand.len());
        let (mut i, mut j) = (0, 0);
        while i < result.len() && j < strand.len() {
            if t.cmp_items(&strand[j], &result[i]) == Ordering::Less {
                merged.push(strand[j]);
                j += 1;
            } else {
                merged.push(result[i]);
                i += 1;
            }
        }
        merged.extend_from_slice(&result[i..]);
        merged.extend_from_slice(&strand[j..]);
        result = merged;
        t.aux("strand", &[]);
        t.aux("result", &result);
    }
    for (k, x) in result.iter().enumerate() {
        t.set(v, k, *x);
    }
    t.aux_clear("input");
    t.aux_clear("result");
    Outcome::Sorted
}
