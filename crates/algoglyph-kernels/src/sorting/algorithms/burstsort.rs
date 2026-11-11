//! Burstsort (Sinha & Zobel 2004, "Cache-conscious sorting of large sets of strings with
//! dynamic tries", ACM JEA 9): a burst trie. Every key is read as a string of 4 bytes (the
//! key with the sign bit flipped, most significant byte first); the trie's nodes have one
//! slot per byte value, and a slot holds either a child node or a container (bucket) of keys
//! that share the prefix so far. A container that grows beyond a threshold "bursts" into a
//! new node one byte deeper, its keys redistributed. Finally the trie is traversed in byte
//! order and every container is sorted and output. Containers are aux `trie` (all of them, in
//! trie order).
//!
//! Simplified: the paper's containers hold up to 8192 string pointers and are sorted by
//! multikey quicksort; here the threshold is 32 keys (`options.k` sets it) and containers are
//! sorted by insertion sort (which happens to keep equal keys in input order; burstsort as
//! published, with multikey quicksort, is not stable).
use crate::sorting::kit;
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "burstsort",
    stable: Stability::No,
    in_place: false,
    kind: Kind::Distribution,
};

enum Slot {
    Empty,
    Bucket(Vec<Item>),
    Node(Box<Node>),
}

struct Node {
    slots: Vec<Slot>,
}

impl Node {
    fn new() -> Self {
        Node {
            slots: (0..256).map(|_| Slot::Empty).collect(),
        }
    }
}

fn byte(x: &Item, depth: u32) -> usize {
    ((kit::biased(x.key) >> (24 - 8 * depth)) & 0xFF) as usize
}

fn insert(node: &mut Node, x: Item, depth: u32, threshold: usize) {
    let b = byte(&x, depth);
    match &mut node.slots[b] {
        Slot::Empty => node.slots[b] = Slot::Bucket(vec![x]),
        Slot::Bucket(items) => {
            items.push(x);
            if items.len() > threshold && depth < 3 {
                let items = std::mem::take(items);
                let mut child = Node::new();
                for y in items {
                    insert(&mut child, y, depth + 1, threshold);
                }
                node.slots[b] = Slot::Node(Box::new(child));
            }
        }
        Slot::Node(child) => insert(child, x, depth + 1, threshold),
    }
}

fn flatten(node: &Node, out: &mut Vec<Item>) {
    for s in &node.slots {
        match s {
            Slot::Empty => {}
            Slot::Bucket(items) => out.extend_from_slice(items),
            Slot::Node(child) => flatten(child, out),
        }
    }
}

fn collect(t: &mut Tracer, node: &mut Node, out: &mut Vec<Item>) {
    for s in node.slots.iter_mut() {
        match s {
            Slot::Empty => {}
            Slot::Bucket(items) => {
                for i in 1..items.len() {
                    let mut j = i;
                    while j > 0 && t.cmp_items(&items[j - 1], &items[j]) == Ordering::Greater {
                        items.swap(j - 1, j);
                        j -= 1;
                    }
                }
                out.extend_from_slice(items);
            }
            Slot::Node(child) => collect(t, child, out),
        }
    }
}

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, opt: &Options) -> Outcome {
    let threshold = if opt.k >= 1 { opt.k as usize } else { 32 };
    let n = v.len();
    if n < 2 {
        return Outcome::Sorted;
    }
    let mut root = Node::new();
    t.phase("insert into the burst trie");
    for i in 0..n {
        let x = t.read(v, i);
        insert(&mut root, x, 0, threshold);
        if i % 16 == 15 || i + 1 == n {
            let mut flat = Vec::with_capacity(i + 1);
            flatten(&root, &mut flat);
            t.aux("trie", &flat);
        }
    }
    t.phase("traverse, sort containers, output");
    let mut out = Vec::with_capacity(n);
    collect(t, &mut root, &mut out);
    kit::write_back(t, v, 0, &out);
    t.aux_clear("trie");
    Outcome::Sorted
}
