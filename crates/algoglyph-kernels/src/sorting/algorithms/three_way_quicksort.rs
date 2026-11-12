//! Three-Way Quicksort (Dijkstra's "Dutch national flag" partition, A Discipline of
//! Programming 1976, ch. 14; as Quick3way in Sedgewick & Wayne 2011, §2.3; analysed by
//! Bentley & McIlroy 1993): one left-to-right scan splits the range into < pivot, = pivot
//! and > pivot, so keys equal to the pivot are never touched again and inputs with few
//! distinct keys sort in linear time. The pivot is a random element (Sedgewick & Wayne shuffle
//! the input first; choosing at random per partition is equivalent). Not stable, in place.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "three-way-quicksort",
    stable: Stability::No,
    in_place: true,
    kind: Kind::Comparison,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    quick3(t, v, 0, n);
    Outcome::Sorted
}

fn quick3(t: &mut Tracer, v: &mut [Item], mut lo: usize, mut hi: usize) {
    while hi - lo > 1 {
        t.mark(lo, hi, "partition");
        let r = t.rng().range(lo, hi);
        t.swap(v, lo, r);
        // invariant: [lo, lt) < p, [lt, i) == p (v[lt] is a copy of the pivot), (gt, hi) > p
        let (mut lt, mut i, mut gt) = (lo, lo + 1, hi - 1);
        while i <= gt {
            match t.cmp(v, i, lt) {
                Ordering::Less => {
                    t.swap(v, lt, i);
                    lt += 1;
                    i += 1;
                }
                Ordering::Greater => {
                    t.swap(v, i, gt);
                    if gt == 0 {
                        break;
                    }
                    gt -= 1;
                }
                Ordering::Equal => i += 1,
            }
        }
        t.mark(lt, gt + 1, "equal to pivot");
        if lt - lo < hi - (gt + 1) {
            quick3(t, v, lo, lt);
            lo = gt + 1;
        } else {
            quick3(t, v, gt + 1, hi);
            hi = lt;
        }
    }
}
