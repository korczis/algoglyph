//! Tree Sort (Knuth 1998, TAOCP 3, §6.2.2 "tree insertion"; the binary search tree of Windley
//! 1960, Booth & Colin 1960, Hibbard 1962): the elements are inserted one by one into an
//! unbalanced binary search tree (aux `tree`, the nodes in insertion order) and written back
//! by an in-order traversal. Equal keys go to the right subtree, so the in-order keeps their
//! input order (stable). O(n log n) on average, O(n^2) on sorted input (a degenerate tree).
//! Not in place.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "tree-sort",
    stable: Stability::Variant,
    in_place: false,
    kind: Kind::Comparison,
};

const NIL: usize = usize::MAX;

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if n < 2 {
        return Outcome::Sorted;
    }
    let mut keys: Vec<Item> = Vec::with_capacity(n);
    let mut left: Vec<usize> = Vec::with_capacity(n);
    let mut right: Vec<usize> = Vec::with_capacity(n);
    t.phase("insert into the search tree");
    for i in 0..n {
        let x = t.read(v, i);
        let id = keys.len();
        keys.push(x);
        left.push(NIL);
        right.push(NIL);
        if id > 0 {
            let mut cur = 0;
            loop {
                if t.cmp_items(&x, &keys[cur]) == Ordering::Less {
                    if left[cur] == NIL {
                        left[cur] = id;
                        break;
                    }
                    cur = left[cur];
                } else {
                    if right[cur] == NIL {
                        right[cur] = id;
                        break;
                    }
                    cur = right[cur];
                }
            }
        }
        t.aux("tree", &keys);
    }
    t.phase("in-order traversal");
    let mut stack: Vec<usize> = Vec::new();
    let mut cur = 0;
    let mut k = 0;
    while cur != NIL || !stack.is_empty() {
        while cur != NIL {
            stack.push(cur);
            cur = left[cur];
        }
        let node = stack.pop().unwrap();
        t.set(v, k, keys[node]);
        k += 1;
        cur = right[node];
    }
    t.aux_clear("tree");
    Outcome::Sorted
}
