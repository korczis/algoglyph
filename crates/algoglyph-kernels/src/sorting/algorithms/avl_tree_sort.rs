//! AVL Tree Sort: tree sort on an AVL tree (Adelson-Velsky & Landis 1962, "An algorithm for
//! the organization of information", Soviet Mathematics Doklady 3; Knuth 1998, §6.2.3).
//! Every insertion rebalances with single or double rotations so that the heights of
//! sibling subtrees differ by at most one, which bounds the height by 1.44 log2 n and the
//! sort by O(n log n) in the worst case. Equal keys go right (stable in-order). The nodes are
//! aux `tree` (insertion order). Not in place.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "avl-tree-sort",
    stable: Stability::Variant,
    in_place: false,
    kind: Kind::Comparison,
};

const NIL: usize = usize::MAX;

struct Avl {
    key: Vec<Item>,
    left: Vec<usize>,
    right: Vec<usize>,
    height: Vec<i32>,
}

impl Avl {
    fn h(&self, x: usize) -> i32 {
        if x == NIL {
            0
        } else {
            self.height[x]
        }
    }
    fn fix(&mut self, x: usize) {
        self.height[x] = 1 + self.h(self.left[x]).max(self.h(self.right[x]));
    }
    fn rot_right(&mut self, y: usize) -> usize {
        let x = self.left[y];
        self.left[y] = self.right[x];
        self.right[x] = y;
        self.fix(y);
        self.fix(x);
        x
    }
    fn rot_left(&mut self, x: usize) -> usize {
        let y = self.right[x];
        self.right[x] = self.left[y];
        self.left[y] = x;
        self.fix(x);
        self.fix(y);
        y
    }
    fn balance(&mut self, x: usize) -> usize {
        self.fix(x);
        let b = self.h(self.left[x]) - self.h(self.right[x]);
        if b > 1 {
            let l = self.left[x];
            if self.h(self.left[l]) < self.h(self.right[l]) {
                self.left[x] = self.rot_left(l);
            }
            return self.rot_right(x);
        }
        if b < -1 {
            let r = self.right[x];
            if self.h(self.right[r]) < self.h(self.left[r]) {
                self.right[x] = self.rot_right(r);
            }
            return self.rot_left(x);
        }
        x
    }
    fn insert(&mut self, t: &mut Tracer, node: usize, id: usize) -> usize {
        if node == NIL {
            return id;
        }
        let x = self.key[id];
        if t.cmp_items(&x, &self.key[node]) == Ordering::Less {
            let l = self.left[node];
            self.left[node] = self.insert(t, l, id);
        } else {
            let r = self.right[node];
            self.right[node] = self.insert(t, r, id);
        }
        self.balance(node)
    }
}

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if n < 2 {
        return Outcome::Sorted;
    }
    let mut tree = Avl {
        key: Vec::with_capacity(n),
        left: Vec::new(),
        right: Vec::new(),
        height: Vec::new(),
    };
    let mut root = NIL;
    t.phase("insert into the AVL tree");
    for i in 0..n {
        let x = t.read(v, i);
        tree.key.push(x);
        tree.left.push(NIL);
        tree.right.push(NIL);
        tree.height.push(1);
        root = tree.insert(t, root, i);
        t.aux("tree", &tree.key);
    }
    t.phase("in-order traversal");
    let mut stack = Vec::new();
    let (mut cur, mut k) = (root, 0);
    while cur != NIL || !stack.is_empty() {
        while cur != NIL {
            stack.push(cur);
            cur = tree.left[cur];
        }
        let node = stack.pop().unwrap();
        t.set(v, k, tree.key[node]);
        k += 1;
        cur = tree.right[node];
    }
    t.aux_clear("tree");
    Outcome::Sorted
}
