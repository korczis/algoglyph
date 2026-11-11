//! Multi-Pivot Quicksort: the 3-pivot quicksort of Kushagra, López-Ortiz, Qiao & Munro 2014
//! ("Multi-Pivot Quicksort: Theory and Experiments", ALENEX), Algorithm A.1.1. Three pivots
//! p <= q <= r split the range into four parts in one pass with four indices a, b, c, d
//! (a and b move right, c and d move left), the scheme the authors show to need fewer cache
//! misses than 1- and 2-pivot partitioning. The pivots are the quartile elements, sorted and
//! moved to positions left, left+1 and right (the paper leaves the choice open); ranges of
//! fewer than 4 elements use insertion sort. Not stable, in place.
use crate::sorting::kit;
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "multi-pivot-quicksort",
    stable: Stability::No,
    in_place: true,
    kind: Kind::Comparison,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if n > 1 {
        three_pivot(t, v, 0, n - 1);
    }
    Outcome::Sorted
}

fn three_pivot(t: &mut Tracer, v: &mut [Item], left: usize, right: usize) {
    let len = right - left + 1;
    if len < 4 {
        kit::insertion(t, v, left, right + 1);
        return;
    }
    t.mark(left, right + 1, "3-pivot partition");
    let (q1, q2, q3) = (left + len / 4, left + len / 2, left + 3 * len / 4);
    kit::sort3(t, v, q1, q2, q3);
    t.swap(v, q1, left);
    t.swap(v, q2, left + 1);
    t.swap(v, q3, right);
    // p = v[left], q = v[left + 1], r = v[right]; compared by position
    let (pp, qq, rr) = (left, left + 1, right);
    let (mut a, mut b) = (left + 2, left + 2);
    let (mut c, mut d) = (right - 1, right - 1);
    while b <= c {
        while b <= c && t.cmp(v, b, qq) == Ordering::Less {
            if t.cmp(v, b, pp) == Ordering::Less {
                t.swap(v, a, b);
                a += 1;
            }
            b += 1;
        }
        while b <= c && t.cmp(v, c, qq) == Ordering::Greater {
            if t.cmp(v, c, rr) == Ordering::Greater {
                t.swap(v, c, d);
                d -= 1;
            }
            c -= 1;
        }
        if b <= c {
            if t.cmp(v, b, rr) == Ordering::Greater {
                if t.cmp(v, c, pp) == Ordering::Less {
                    t.swap(v, b, a);
                    t.swap(v, a, c);
                    a += 1;
                } else {
                    t.swap(v, b, c);
                }
                t.swap(v, c, d);
                b += 1;
                c -= 1;
                d -= 1;
            } else {
                if t.cmp(v, c, pp) == Ordering::Less {
                    t.swap(v, b, a);
                    t.swap(v, a, c);
                    a += 1;
                } else {
                    t.swap(v, b, c);
                }
                b += 1;
                c -= 1;
            }
        }
    }
    a -= 1;
    b -= 1;
    d += 1;
    t.swap(v, left + 1, a);
    t.swap(v, a, b);
    a -= 1;
    t.swap(v, left, a);
    t.swap(v, right, d);
    // p at a, q at b, r at d
    if a > left + 1 {
        three_pivot(t, v, left, a - 1);
    }
    if b > a + 2 {
        three_pivot(t, v, a + 1, b - 1);
    }
    if d > b + 2 {
        three_pivot(t, v, b + 1, d - 1);
    }
    if right > d + 1 {
        three_pivot(t, v, d + 1, right);
    }
}
