//! Tournament Sort (Knuth 1998, TAOCP 3, §5.2.3, "tree selection" / knockout tournament):
//! the elements are the leaves of a complete binary winner tree (aux `tournament`, 2n - 1
//! nodes); every internal node holds the winner (the smaller key) of its two children, so the
//! root is the minimum. The minimum is output, its leaf replaced by "+infinity", and only the
//! matches on its path to the root are replayed (log n comparisons). Ties go to the left
//! (lower original position), which makes it stable. Not in place.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "tournament-sort",
    stable: Stability::Variant,
    in_place: false,
    kind: Kind::Comparison,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if n < 2 {
        return Outcome::Sorted;
    }
    let size = n.next_power_of_two();
    // tree[1..2*size): leaves at size.., node values are leaf indices (usize::MAX = +inf)
    let leaves: Vec<Item> = (0..n).map(|i| t.read(v, i)).collect();
    const INF: usize = usize::MAX;
    let mut tree = vec![INF; 2 * size];
    for i in 0..n {
        tree[size + i] = i;
    }
    let winner = |t: &mut Tracer, a: usize, b: usize| -> usize {
        match (a, b) {
            (INF, _) => b,
            (_, INF) => a,
            _ => {
                if t.cmp_items(&leaves[b], &leaves[a]) == Ordering::Less {
                    b
                } else {
                    a
                }
            }
        }
    };
    t.phase("play the tournament");
    for node in (1..size).rev() {
        tree[node] = winner(t, tree[2 * node], tree[2 * node + 1]);
    }
    snapshot(t, &tree, &leaves);
    t.phase("output winners, replay their paths");
    for k in 0..n {
        let w = tree[1];
        t.set(v, k, leaves[w]);
        let mut node = size + w;
        tree[node] = INF;
        while node > 1 {
            node /= 2;
            tree[node] = winner(t, tree[2 * node], tree[2 * node + 1]);
        }
        if k % 8 == 7 || k + 1 == n {
            snapshot(t, &tree, &leaves);
        }
    }
    t.aux_clear("tournament");
    Outcome::Sorted
}

/// The tree's nodes in level order (root first), an emptied node as an empty cell.
fn snapshot(t: &mut Tracer, tree: &[usize], leaves: &[Item]) {
    let cells: Vec<Option<Item>> = tree[1..]
        .iter()
        .map(|&x| (x != usize::MAX).then(|| leaves[x]))
        .collect();
    t.aux_cells("tournament", &cells);
}
