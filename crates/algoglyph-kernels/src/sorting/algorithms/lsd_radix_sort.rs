//! LSD Radix Sort with queues (Knuth 1998, TAOCP 3, §5.2.5, radix sorting by "pockets"; the
//! card-sorter method): the keys (sign bit flipped, so signed order becomes unsigned order)
//! are processed one byte at a time from the least significant; each pass appends every
//! element to the queue of its digit (256 queues, aux `queues` in queue order) and then
//! collects the queues in order. A pass in which every key has the same digit is skipped.
//! `options.base` may choose 2, 4, 16, 256 or 65536 (a power of two). Stable, not in place.
use crate::sorting::kit;
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "lsd-radix-sort",
    stable: Stability::Yes,
    in_place: false,
    kind: Kind::Distribution,
};

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, opt: &Options) -> Outcome {
    let bits: u32 = match opt.base {
        2 => 1,
        4 => 2,
        16 => 4,
        65536 => 16,
        _ => 8,
    };
    let radix = 1usize << bits;
    let n = v.len();
    if n < 2 {
        return Outcome::Sorted;
    }
    let mask = (radix - 1) as u32;
    let mut shift = 0;
    while shift < 32 {
        let digit = |x: &Item| ((kit::biased(x.key) >> shift) & mask) as usize;
        let first = digit(&v[0]);
        let mut queues: Vec<Vec<Item>> = vec![Vec::new(); radix];
        let mut same = true;
        for i in 0..n {
            let x = t.read(v, i);
            let d = digit(&x);
            same &= d == first;
            queues[d].push(x);
        }
        if !same {
            t.phase(&format!("pass on bits {shift}..{}", shift + bits));
            let flat: Vec<Item> = queues.iter().flatten().copied().collect();
            t.aux("queues", &flat);
            kit::write_back(t, v, 0, &flat);
            // collected: the queues are empty again, and the next pass fills them anew
            t.aux_clear("queues");
        }
        shift += bits;
    }
    Outcome::Sorted
}
