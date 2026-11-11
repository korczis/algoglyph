//! Splaysort (Moffat, Eddy & Petersson 1996, "Splaysort: Fast, Versatile, Practical",
//! Software: Practice and Experience 26(7)): tree sort on a splay tree (Sleator & Tarjan
//! 1985). Each inserted node is splayed to the root by zig, zig-zig and zig-zag rotations,
//! so recently inserted neighbourhoods stay near the root and presorted inputs cost
//! O(n log(1 + Inv/n)). Equal keys go right (stable in-order). The nodes are aux `tree`.
//! Not in place.
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "splaysort",
    stable: Stability::Variant,
    in_place: false,
    kind: Kind::Comparison,
};

const NIL: usize = usize::MAX;

struct Splay {
    key: Vec<Item>,
    left: Vec<usize>,
    right: Vec<usize>,
    parent: Vec<usize>,
    root: usize,
}

impl Splay {
    fn rotate(&mut self, x: usize) {
        let p = self.parent[x];
        let g = self.parent[p];
        if self.left[p] == x {
            let b = self.right[x];
            self.left[p] = b;
            if b != NIL {
                self.parent[b] = p;
            }
            self.right[x] = p;
        } else {
            let b = self.left[x];
            self.right[p] = b;
            if b != NIL {
                self.parent[b] = p;
            }
            self.left[x] = p;
        }
        self.parent[p] = x;
        self.parent[x] = g;
        if g == NIL {
            self.root = x;
        } else if self.left[g] == p {
            self.left[g] = x;
        } else {
            self.right[g] = x;
        }
    }

    fn splay(&mut self, x: usize) {
        while self.parent[x] != NIL {
            let p = self.parent[x];
            let g = self.parent[p];
            if g != NIL {
                let zigzig = (self.left[g] == p) == (self.left[p] == x);
                if zigzig {
                    self.rotate(p);
                } else {
                    self.rotate(x);
                }
            }
            self.rotate(x);
        }
    }
}

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if n < 2 {
        return Outcome::Sorted;
    }
    let mut s = Splay {
        key: Vec::with_capacity(n),
        left: Vec::new(),
        right: Vec::new(),
        parent: Vec::new(),
        root: NIL,
    };
    t.phase("insert and splay");
    for i in 0..n {
        let x = t.read(v, i);
        s.key.push(x);
        s.left.push(NIL);
        s.right.push(NIL);
        s.parent.push(NIL);
        if s.root == NIL {
            s.root = i;
        } else {
            let mut cur = s.root;
            loop {
                if t.cmp_items(&x, &s.key[cur]) == Ordering::Less {
                    if s.left[cur] == NIL {
                        s.left[cur] = i;
                        break;
                    }
                    cur = s.left[cur];
                } else {
                    if s.right[cur] == NIL {
                        s.right[cur] = i;
                        break;
                    }
                    cur = s.right[cur];
                }
            }
            s.parent[i] = cur;
            s.splay(i);
        }
        t.aux("tree", &s.key);
    }
    t.phase("in-order traversal");
    let mut stack = Vec::new();
    let (mut cur, mut k) = (s.root, 0);
    while cur != NIL || !stack.is_empty() {
        while cur != NIL {
            stack.push(cur);
            cur = s.left[cur];
        }
        let node = stack.pop().unwrap();
        t.set(v, k, s.key[node]);
        k += 1;
        cur = s.right[node];
    }
    t.aux_clear("tree");
    Outcome::Sorted
}
