//! Flashsort (Neubert 1998, "The Flashsort1 Algorithm", Dr. Dobb's Journal, February 1998):
//! classification by linear interpolation into m classes, K(x) = ⌊(m - 1)(x - min) /
//! (max - min)⌋ with m = ⌊0.42 n⌋ (a fraction of n, as in Neubert's article); the class sizes
//! are counted and accumulated (the class regions are marked), and the elements are
//! permuted into their classes in place by Neubert's cycle-leader "flash" permutation (the
//! maximum is first swapped to position 0 so the first cycle starts in the last class). The nearly sorted
//! result is finished by insertion sort. O(n) on uniformly distributed keys. Not stable; in
//! place apart from the vector of m class counters (counters, not elements).
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "flashsort",
    stable: Stability::No,
    in_place: true,
    kind: Kind::Distribution,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if n < 2 {
        return Outcome::Sorted;
    }
    let (mut imin, mut imax) = (0, 0);
    for i in 1..n {
        if t.cmp(v, i, imin) == Ordering::Less {
            imin = i;
        }
        if t.cmp(v, i, imax) == Ordering::Greater {
            imax = i;
        }
    }
    let min = v[imin].key as i64;
    let max = v[imax].key as i64;
    if min == max {
        return Outcome::Sorted;
    }
    let m = ((n * 42) / 100).max(2);
    let class = |x: &Item| -> usize {
        (((m - 1) as i128 * (x.key as i64 - min) as i128) / (max - min) as i128) as usize
    };
    t.phase(&format!("classify into {m} classes"));
    let mut l = vec![0isize; m];
    for i in 0..n {
        let x = t.read(v, i);
        l[class(&x)] += 1;
    }
    for k in 1..m {
        l[k] += l[k - 1];
    }
    let mut from = 0;
    for k in 0..m {
        if l[k] as usize > from {
            t.mark(from, l[k] as usize, &format!("class {k}"));
        }
        from = l[k] as usize;
    }
    t.swap(v, imax, 0);
    t.phase("flash permutation");
    let mut nmove = 0;
    let mut j: usize = 0;
    let mut k = m - 1;
    while nmove < n - 1 {
        while j as isize > l[k] - 1 {
            j += 1;
            k = class(&v[j]);
        }
        let mut flash = t.read(v, j);
        while j as isize != l[k] {
            k = class(&flash);
            let p = (l[k] - 1) as usize;
            let hold = t.read(v, p);
            t.set(v, p, flash);
            flash = hold;
            l[k] -= 1;
            nmove += 1;
        }
    }
    t.phase("insertion sort");
    for i in 1..n {
        let x = t.read(v, i);
        let mut q = i;
        while q > 0 && t.cmp_at(&x, v, q - 1) == Ordering::Less {
            let y = v[q - 1];
            t.set(v, q, y);
            q -= 1;
        }
        if q != i {
            t.set(v, q, x);
        }
    }
    Outcome::Sorted
}
