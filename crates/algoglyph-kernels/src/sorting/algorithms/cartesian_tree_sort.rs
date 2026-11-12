//! Cartesian Tree Sort (Levcopoulos & Petersson 1989, "Heapsort—adapted for presorted
//! files", WADS, LNCS 382; the Cartesian tree is Vuillemin's 1980). The Cartesian tree of the
//! input (a min-heap ordered binary tree whose in-order is the input) is built in O(n) with
//! a stack along the right spine. Then a priority queue (binary heap, aux `queue`) starts
//! with the root; each step outputs the smallest queued node and queues its two children.
//! The queue stays small on presorted inputs, giving O(n log(Osc/n)) adaptivity. The nodes
//! are copies of the input (aux `nodes`). Not stable, not in place.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "cartesian-tree-sort",
    stable: Stability::No,
    in_place: false,
    kind: Kind::Comparison,
};

const NIL: usize = usize::MAX;

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if n < 2 {
        return Outcome::Sorted;
    }
    let nodes: Vec<Item> = (0..n).map(|i| t.read(v, i)).collect();
    t.aux("nodes", &nodes);
    let mut left = vec![NIL; n];
    let mut right = vec![NIL; n];
    let mut stack: Vec<usize> = Vec::new();
    t.phase("build the Cartesian tree");
    for i in 0..n {
        let mut last = NIL;
        while let Some(&top) = stack.last() {
            if t.cmp_items(&nodes[top], &nodes[i]) == Ordering::Greater {
                last = stack.pop().unwrap();
            } else {
                break;
            }
        }
        left[i] = last;
        if let Some(&top) = stack.last() {
            right[top] = i;
        }
        stack.push(i);
    }
    let root = stack[0];
    t.phase("output minima through a priority queue");
    let mut heap: Vec<usize> = vec![root];
    for k in 0..n {
        let m = pop(t, &nodes, &mut heap);
        t.set(v, k, nodes[m]);
        for c in [left[m], right[m]] {
            if c != NIL {
                push(t, &nodes, &mut heap, c);
            }
        }
        let q: Vec<Item> = heap.iter().map(|&i| nodes[i]).collect();
        t.aux("queue", &q);
    }
    t.aux_clear("queue");
    t.aux_clear("nodes");
    Outcome::Sorted
}

fn push(t: &mut Tracer, nodes: &[Item], heap: &mut Vec<usize>, x: usize) {
    heap.push(x);
    let mut i = heap.len() - 1;
    while i > 0 {
        let p = (i - 1) / 2;
        if t.cmp_items(&nodes[heap[i]], &nodes[heap[p]]) == Ordering::Less {
            heap.swap(i, p);
            i = p;
        } else {
            break;
        }
    }
}

fn pop(t: &mut Tracer, nodes: &[Item], heap: &mut Vec<usize>) -> usize {
    let top = heap[0];
    let last = heap.pop().unwrap();
    if !heap.is_empty() {
        heap[0] = last;
        let mut i = 0;
        loop {
            let l = 2 * i + 1;
            if l >= heap.len() {
                break;
            }
            let r = l + 1;
            let c = if r < heap.len()
                && t.cmp_items(&nodes[heap[r]], &nodes[heap[l]]) == Ordering::Less
            {
                r
            } else {
                l
            };
            if t.cmp_items(&nodes[heap[c]], &nodes[heap[i]]) == Ordering::Less {
                heap.swap(i, c);
                i = c;
            } else {
                break;
            }
        }
    }
    top
}
