//! Shellsort (Shell 1959, "A high-speed sorting procedure", Communications of the ACM 2(7);
//! Knuth 1998, §5.2.1, Algorithm D): insertion sort over elements h apart for a decreasing
//! sequence of gaps h ending with 1; the early passes move elements far, the last pass is an
//! ordinary insertion sort on a nearly sorted array. The gap sequence is configurable with
//! `options.k`: 0 = Ciura 2001 (1, 4, 10, 23, 57, 132, 301, 701, 1750, extended by x2.25;
//! the default), 1 = Shell's n/2, n/4, …, 2 = Knuth's (3^k - 1)/2, 3 = Sedgewick 1986
//! (4^k + 3·2^(k-1) + 1). Not stable, in place.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "shellsort",
    stable: Stability::No,
    in_place: true,
    kind: Kind::Comparison,
};

fn gaps(n: usize, kind: u32) -> Vec<usize> {
    let mut g: Vec<usize> = Vec::new();
    match kind {
        1 => {
            let mut h = n / 2;
            while h > 0 {
                g.push(h);
                h /= 2;
            }
            g.reverse();
        }
        2 => {
            let mut h = 1;
            while h < n.max(2) {
                g.push(h);
                h = 3 * h + 1;
            }
        }
        3 => {
            g.push(1);
            let mut k = 1u32;
            loop {
                let h = 4usize.pow(k) + 3 * 2usize.pow(k - 1) + 1;
                if h >= n {
                    break;
                }
                g.push(h);
                k += 1;
            }
        }
        _ => {
            for &h in &[1usize, 4, 10, 23, 57, 132, 301, 701, 1750] {
                if h < n.max(2) {
                    g.push(h);
                }
            }
            let mut h = 1750f64;
            loop {
                h = (h * 2.25).floor();
                if h as usize >= n {
                    break;
                }
                g.push(h as usize);
            }
        }
    }
    if g.is_empty() {
        g.push(1);
    }
    g
}

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, opt: &Options) -> Outcome {
    let n = v.len();
    for &h in gaps(n, opt.k).iter().rev() {
        t.phase(&format!("gap {h}"));
        for i in h..n {
            let x = t.read(v, i);
            let mut j = i;
            while j >= h && t.cmp_at(&x, v, j - h) == Ordering::Less {
                let y = v[j - h];
                t.set(v, j, y);
                j -= h;
            }
            if j != i {
                t.set(v, j, x);
            }
        }
    }
    Outcome::Sorted
}
