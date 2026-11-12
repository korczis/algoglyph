//! D-ary Heapsort (Johnson 1975, "Priority queues with update and finding minimum spanning
//! trees", Information Processing Letters 4(3), introduced d-heaps; Knuth 1998, §5.2.3,
//! exercise 5.2.3-37): heapsort on a max-heap in which every node has d children (node i has
//! children d i + 1 … d i + d). A shallower heap (log_d n levels) costs d - 1 comparisons
//! per level to find the largest child. d = 3 by default (`options.k` sets 2…16). Not
//! stable, in place.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "d-ary-heapsort",
    stable: Stability::No,
    in_place: true,
    kind: Kind::Comparison,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, opt: &Options) -> Outcome {
    let d = if (2..=16).contains(&opt.k) {
        opt.k as usize
    } else {
        3
    };
    let n = v.len();
    if n < 2 {
        return Outcome::Sorted;
    }
    t.phase(&format!("build {d}-ary max-heap"));
    for root in (0..=(n - 2) / d).rev() {
        sift(t, v, root, n, d);
    }
    t.phase("extract maxima");
    for end in (1..n).rev() {
        t.swap(v, 0, end);
        sift(t, v, 0, end, d);
        t.mark(end, n, "sorted");
    }
    Outcome::Sorted
}

fn sift(t: &mut Tracer, v: &mut [Item], mut i: usize, n: usize, d: usize) {
    loop {
        let first = d * i + 1;
        if first >= n {
            return;
        }
        let mut big = first;
        for c in (first + 1)..(first + d).min(n) {
            if t.cmp(v, c, big) == Ordering::Greater {
                big = c;
            }
        }
        if t.cmp(v, big, i) != Ordering::Greater {
            return;
        }
        t.swap(v, i, big);
        i = big;
    }
}
