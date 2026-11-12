//! LearnedSort (Kristo, Vaidya, Çetintemel, Misra & Kraska 2020, "The Case for a Learned
//! Sorting Algorithm", SIGMOD; code github.com/learnedsystems/LearnedSort). A model of the
//! keys' cumulative distribution function (CDF) is trained on a sample, and the model's
//! prediction places every key near its final position:
//!
//! 1. a random sample (about √n keys, at least 16; seeded) is sorted;
//! 2. a two-layer recursive model index (RMI) is fitted to the sample's empirical CDF: a
//!    linear root model picks one of the leaf models, and each leaf is a linear regression of
//!    rank on key over the sample points routed to it;
//! 3. every key goes to bucket ⌊CDF(x) · B⌋ (B ≈ n/8 buckets, aux `buckets`), keeping order;
//! 4. buckets are concatenated and a final insertion sort repairs what the model got wrong
//!    (the "touch-up" pass of the paper).
//!
//! Simplified: the paper's model-based counting sort inside each fragment, its spill bucket
//! for overflowing fragments and its many-buckets tuning are replaced by the ordered buckets
//! and the insertion-sort touch-up. Not stable by design of the original (this simplification
//! happens to keep equal keys in order); not in place.
use crate::sorting::kit;
use crate::sorting::prelude::*;

pub const META: Meta = Meta {
    id: "learnedsort",
    stable: Stability::No,
    in_place: false,
    kind: Kind::Distribution,
};

#[derive(Clone, Copy, Default)]
struct Linear {
    slope: f64,
    intercept: f64,
}

impl Linear {
    fn fit(xs: &[f64], ys: &[f64]) -> Self {
        let n = xs.len() as f64;
        if xs.is_empty() {
            return Linear::default();
        }
        let mx = xs.iter().sum::<f64>() / n;
        let my = ys.iter().sum::<f64>() / n;
        let mut sxy = 0.0;
        let mut sxx = 0.0;
        for (x, y) in xs.iter().zip(ys) {
            sxy += (x - mx) * (y - my);
            sxx += (x - mx) * (x - mx);
        }
        let slope = if sxx > 0.0 { sxy / sxx } else { 0.0 };
        Linear {
            slope,
            intercept: my - slope * mx,
        }
    }
    fn predict(&self, x: f64) -> f64 {
        self.slope * x + self.intercept
    }
}

pub fn sort(t: &mut Tracer, v: &mut Vec<Item>, _opt: &Options) -> Outcome {
    let n = v.len();
    if n < 16 {
        kit::insertion(t, v, 0, n);
        return Outcome::Sorted;
    }
    // 1. sample
    let s = ((n as f64).sqrt() as usize).max(16).min(n);
    t.phase(&format!("sample {s} keys"));
    let mut sample: Vec<Item> = (0..s)
        .map(|_| {
            let i = t.rng().range(0, n);
            t.read(v, i)
        })
        .collect();
    for i in 1..sample.len() {
        let mut j = i;
        while j > 0 && t.cmp_items(&sample[j - 1], &sample[j]) == Ordering::Greater {
            sample.swap(j - 1, j);
            j -= 1;
        }
    }
    t.aux("sample", &sample);
    // 2. two-layer RMI on the empirical CDF
    t.phase("train the CDF model (2-layer RMI)");
    let leaves = (s / 8).max(1);
    let xs: Vec<f64> = sample.iter().map(|x| x.key as f64).collect();
    let cdf: Vec<f64> = (0..s).map(|i| i as f64 / s as f64).collect();
    let root_y: Vec<f64> = cdf.iter().map(|c| c * leaves as f64).collect();
    let root = Linear::fit(&xs, &root_y);
    let leaf_of = |x: f64| -> usize { (root.predict(x).max(0.0) as usize).min(leaves - 1) };
    let mut leaf_x: Vec<Vec<f64>> = vec![Vec::new(); leaves];
    let mut leaf_y: Vec<Vec<f64>> = vec![Vec::new(); leaves];
    for i in 0..s {
        let l = leaf_of(xs[i]);
        leaf_x[l].push(xs[i]);
        leaf_y[l].push(cdf[i]);
    }
    let models: Vec<Linear> = (0..leaves)
        .map(|l| Linear::fit(&leaf_x[l], &leaf_y[l]))
        .collect();
    let predict = |x: f64| -> f64 { models[leaf_of(x)].predict(x).clamp(0.0, 1.0) };
    t.aux_clear("sample");
    // 3. scatter into buckets by predicted position
    let b = (n / 8).max(1);
    t.phase(&format!("place keys into {b} buckets by the model"));
    let mut buckets: Vec<Vec<Item>> = vec![Vec::new(); b];
    for i in 0..n {
        let x = t.read(v, i);
        let k = ((predict(x.key as f64) * b as f64) as usize).min(b - 1);
        buckets[k].push(x);
    }
    let flat: Vec<Item> = buckets.into_iter().flatten().collect();
    t.aux("buckets", &flat);
    kit::write_back(t, v, 0, &flat);
    t.aux_clear("buckets");
    // 4. touch-up
    t.phase("touch-up insertion sort");
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
