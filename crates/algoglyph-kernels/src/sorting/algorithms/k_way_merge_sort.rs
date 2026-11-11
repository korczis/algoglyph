//! K-Way Merge Sort (Knuth 1998, TAOCP 3, §5.4.1, multiway merging with a selection tree;
//! the in-memory form of balanced k-way merging): the range is split into k parts, each is
//! sorted recursively, and the k sorted parts are merged at once with a min-heap of their
//! heads (aux `heads`, k entries) into an output buffer (aux `output`), then copied back.
//! Heap ties go to the lower part index, which keeps it stable. k = 4 by default
//! (`options.k` sets 2…64). Not in place.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "k-way-merge-sort",
    stable: Stability::Yes,
    in_place: false,
    kind: Kind::Comparison,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, opt: &Options) -> Outcome {
    let k = if (2..=64).contains(&opt.k) {
        opt.k as usize
    } else {
        4
    };
    let n = v.len();
    rec(t, v, 0, n, k);
    Outcome::Sorted
}

fn rec(t: &mut Tracer, v: &mut [Item], lo: usize, hi: usize, k: usize) {
    let n = hi - lo;
    if n < 2 {
        return;
    }
    let parts = k.min(n);
    let bounds: Vec<usize> = (0..=parts).map(|p| lo + p * n / parts).collect();
    for p in 0..parts {
        rec(t, v, bounds[p], bounds[p + 1], k);
    }
    t.mark(lo, hi, &format!("{parts}-way merge"));
    // heap of (part) ordered by current head, ties by part index
    let mut pos: Vec<usize> = bounds[..parts].to_vec();
    let mut heap: Vec<usize> = Vec::with_capacity(parts);
    let less = |t: &mut Tracer, v: &[Item], pos: &[usize], a: usize, b: usize| -> bool {
        match t.cmp(v, pos[a], pos[b]) {
            Ordering::Less => true,
            Ordering::Greater => false,
            Ordering::Equal => a < b,
        }
    };
    for p in 0..parts {
        heap.push(p);
        let mut i = heap.len() - 1;
        while i > 0 && less(t, v, &pos, heap[i], heap[(i - 1) / 2]) {
            heap.swap(i, (i - 1) / 2);
            i = (i - 1) / 2;
        }
    }
    let mut out: Vec<Item> = Vec::with_capacity(n);
    while !heap.is_empty() {
        let p = heap[0];
        out.push(t.read(v, pos[p]));
        pos[p] += 1;
        if pos[p] == bounds[p + 1] {
            let last = heap.pop().unwrap();
            if heap.is_empty() {
                break;
            }
            heap[0] = last;
        }
        // sift down from the root
        let mut i = 0;
        loop {
            let l = 2 * i + 1;
            if l >= heap.len() {
                break;
            }
            let r = l + 1;
            let c = if r < heap.len() && less(t, v, &pos, heap[r], heap[l]) {
                r
            } else {
                l
            };
            if less(t, v, &pos, heap[c], heap[i]) {
                heap.swap(i, c);
                i = c;
            } else {
                break;
            }
        }
        let heads: Vec<Item> = heap.iter().map(|&p| v[pos[p]]).collect();
        t.aux("heads", &heads);
        if out.len() % 8 == 0 {
            t.aux("output", &out);
        }
    }
    t.aux("output", &out);
    for (j, x) in out.iter().enumerate() {
        t.set(v, lo + j, *x);
    }
    t.aux_clear("heads");
    t.aux_clear("output");
}
