//! Stable fluids (Jos Stam, SIGGRAPH 1999): a velocity field and a dye density on an
//! (n+2)² grid with a one-cell boundary. Each step diffuses implicitly (Gauss–Seidel),
//! advects semi-Lagrangian (backwards along the velocity, bilinear), and projects the
//! velocity onto its divergence-free part, so the solver is unconditionally stable.
//! Written from the paper's equations; every readout is measured from the fields.

/// One fluid on an n×n interior grid.
pub struct Fluid {
    pub n: usize,
    pub u: Vec<f32>,
    pub v: Vec<f32>,
    pub u0: Vec<f32>,
    pub v0: Vec<f32>,
    pub dens: Vec<f32>,
    pub dens0: Vec<f32>,
    /// Measured after the last step: [total dye, max |div| before projection,
    /// max |div| after projection, kinetic energy].
    pub stats: [f32; 4],
}

impl Fluid {
    pub fn new(n: usize) -> Self {
        let size = (n + 2) * (n + 2);
        Fluid {
            n,
            u: vec![0.0; size],
            v: vec![0.0; size],
            u0: vec![0.0; size],
            v0: vec![0.0; size],
            dens: vec![0.0; size],
            dens0: vec![0.0; size],
            stats: [0.0; 4],
        }
    }

    #[inline]
    pub fn ix(&self, i: usize, j: usize) -> usize {
        i + (self.n + 2) * j
    }

    /// Add dye and momentum at interior cell (i, j), as sources for the next step.
    pub fn add(&mut self, i: usize, j: usize, dye: f32, du: f32, dv: f32) {
        if i < 1 || j < 1 || i > self.n || j > self.n {
            return;
        }
        let k = self.ix(i, j);
        self.dens0[k] += dye;
        self.u0[k] += du;
        self.v0[k] += dv;
    }

    /// Advance by dt with viscosity `visc`, dye diffusion `diff` and `iters` solver sweeps.
    pub fn step(&mut self, dt: f32, visc: f32, diff: f32, iters: usize) {
        let n = self.n;
        // velocity
        add_source(&mut self.u, &self.u0, dt);
        add_source(&mut self.v, &self.v0, dt);
        std::mem::swap(&mut self.u0, &mut self.u);
        diffuse(n, 1, &mut self.u, &self.u0, visc, dt, iters);
        std::mem::swap(&mut self.v0, &mut self.v);
        diffuse(n, 2, &mut self.v, &self.v0, visc, dt, iters);
        project(n, &mut self.u, &mut self.v, &mut self.u0, &mut self.v0, iters);
        std::mem::swap(&mut self.u0, &mut self.u);
        std::mem::swap(&mut self.v0, &mut self.v);
        advect(n, 1, &mut self.u, &self.u0, &self.u0, &self.v0, dt);
        advect(n, 2, &mut self.v, &self.v0, &self.u0, &self.v0, dt);
        let before = max_divergence(n, &self.u, &self.v);
        project(n, &mut self.u, &mut self.v, &mut self.u0, &mut self.v0, iters);
        let after = max_divergence(n, &self.u, &self.v);
        // density
        add_source(&mut self.dens, &self.dens0, dt);
        std::mem::swap(&mut self.dens0, &mut self.dens);
        diffuse(n, 0, &mut self.dens, &self.dens0, diff, dt, iters);
        std::mem::swap(&mut self.dens0, &mut self.dens);
        advect(n, 0, &mut self.dens, &self.dens0, &self.u, &self.v, dt);
        // the sources are consumed
        for x in self.u0.iter_mut().chain(self.v0.iter_mut()).chain(self.dens0.iter_mut()) {
            *x = 0.0;
        }
        let total: f32 = self.dens.iter().sum();
        let energy: f32 = self.u.iter().zip(&self.v).map(|(a, b)| 0.5 * (a * a + b * b)).sum();
        self.stats = [total, before, after, energy];
    }

    /// A checksum of the dye field: what the native and the wasm build must agree on.
    pub fn checksum(&self) -> f64 {
        self.dens.iter().enumerate().map(|(k, d)| (*d as f64) * ((k % 97) as f64 + 1.0)).sum()
    }
}

fn add_source(x: &mut [f32], s: &[f32], dt: f32) {
    for (a, b) in x.iter_mut().zip(s) {
        *a += dt * b;
    }
}

fn set_bnd(n: usize, b: u8, x: &mut [f32]) {
    let ix = |i: usize, j: usize| i + (n + 2) * j;
    for i in 1..=n {
        x[ix(0, i)] = if b == 1 { -x[ix(1, i)] } else { x[ix(1, i)] };
        x[ix(n + 1, i)] = if b == 1 { -x[ix(n, i)] } else { x[ix(n, i)] };
        x[ix(i, 0)] = if b == 2 { -x[ix(i, 1)] } else { x[ix(i, 1)] };
        x[ix(i, n + 1)] = if b == 2 { -x[ix(i, n)] } else { x[ix(i, n)] };
    }
    x[ix(0, 0)] = 0.5 * (x[ix(1, 0)] + x[ix(0, 1)]);
    x[ix(0, n + 1)] = 0.5 * (x[ix(1, n + 1)] + x[ix(0, n)]);
    x[ix(n + 1, 0)] = 0.5 * (x[ix(n, 0)] + x[ix(n + 1, 1)]);
    x[ix(n + 1, n + 1)] = 0.5 * (x[ix(n, n + 1)] + x[ix(n + 1, n)]);
}

fn lin_solve(n: usize, b: u8, x: &mut [f32], x0: &[f32], a: f32, c: f32, iters: usize) {
    let ix = |i: usize, j: usize| i + (n + 2) * j;
    for _ in 0..iters {
        for j in 1..=n {
            for i in 1..=n {
                x[ix(i, j)] = (x0[ix(i, j)]
                    + a * (x[ix(i - 1, j)] + x[ix(i + 1, j)] + x[ix(i, j - 1)] + x[ix(i, j + 1)]))
                    / c;
            }
        }
        set_bnd(n, b, x);
    }
}

fn diffuse(n: usize, b: u8, x: &mut [f32], x0: &[f32], k: f32, dt: f32, iters: usize) {
    let a = dt * k * (n * n) as f32;
    // warm start from the field being diffused: the solution is near it, so few sweeps do
    x.copy_from_slice(x0);
    lin_solve(n, b, x, x0, a, 1.0 + 4.0 * a, iters);
}

fn advect(n: usize, b: u8, d: &mut [f32], d0: &[f32], u: &[f32], v: &[f32], dt: f32) {
    let ix = |i: usize, j: usize| i + (n + 2) * j;
    let dt0 = dt * n as f32;
    let hi = n as f32 + 0.5;
    for j in 1..=n {
        for i in 1..=n {
            let x = (i as f32 - dt0 * u[ix(i, j)]).clamp(0.5, hi);
            let y = (j as f32 - dt0 * v[ix(i, j)]).clamp(0.5, hi);
            let (i0, j0) = (x.floor() as usize, y.floor() as usize);
            let (s1, t1) = (x - i0 as f32, y - j0 as f32);
            let (s0, t0) = (1.0 - s1, 1.0 - t1);
            d[ix(i, j)] = s0 * (t0 * d0[ix(i0, j0)] + t1 * d0[ix(i0, j0 + 1)])
                + s1 * (t0 * d0[ix(i0 + 1, j0)] + t1 * d0[ix(i0 + 1, j0 + 1)]);
        }
    }
    set_bnd(n, b, d);
}

fn project(n: usize, u: &mut [f32], v: &mut [f32], p: &mut [f32], div: &mut [f32], iters: usize) {
    let ix = |i: usize, j: usize| i + (n + 2) * j;
    let h = 1.0 / n as f32;
    for j in 1..=n {
        for i in 1..=n {
            div[ix(i, j)] = -0.5 * h * (u[ix(i + 1, j)] - u[ix(i - 1, j)] + v[ix(i, j + 1)] - v[ix(i, j - 1)]);
            p[ix(i, j)] = 0.0;
        }
    }
    set_bnd(n, 0, div);
    set_bnd(n, 0, p);
    lin_solve(n, 0, p, div, 1.0, 4.0, iters);
    for j in 1..=n {
        for i in 1..=n {
            u[ix(i, j)] -= 0.5 * (p[ix(i + 1, j)] - p[ix(i - 1, j)]) / h;
            v[ix(i, j)] -= 0.5 * (p[ix(i, j + 1)] - p[ix(i, j - 1)]) / h;
        }
    }
    set_bnd(n, 1, u);
    set_bnd(n, 2, v);
}

/// The largest absolute central-difference divergence over the interior, per cell width.
pub fn max_divergence(n: usize, u: &[f32], v: &[f32]) -> f32 {
    let ix = |i: usize, j: usize| i + (n + 2) * j;
    let mut m = 0.0f32;
    for j in 1..=n {
        for i in 1..=n {
            let d = 0.5 * (u[ix(i + 1, j)] - u[ix(i - 1, j)] + v[ix(i, j + 1)] - v[ix(i, j - 1)]);
            m = m.max(d.abs());
        }
    }
    m
}

/// The scenario the native tests and the wasm equivalence test both run (fixtures/fluids.json).
pub fn scenario(n: usize, steps: usize) -> Fluid {
    let mut f = Fluid::new(n);
    for s in 0..steps {
        let c = n / 2;
        f.add(c, c / 2, 120.0, 0.0, 6.0);
        f.add(c / 2 + s % 3, c, 40.0, 4.0, 0.0);
        f.step(0.1, 0.0001, 0.0001, 20);
    }
    f
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn projection_reduces_divergence_and_more_sweeps_reduce_it_more() {
        // the maximum norm is the harshest measure: Gauss-Seidel removes the fine error fast
        // and the broad error slowly, so the claim is a reduction that deepens with sweeps
        let run = |iters: usize| {
            let mut f = Fluid::new(48);
            for _ in 0..8 {
                f.add(24, 12, 120.0, 0.0, 6.0);
                f.add(12, 24, 40.0, 4.0, 0.0);
                f.step(0.1, 0.0001, 0.0001, iters);
            }
            f.stats
        };
        let [_, before, after, _] = run(20);
        assert!(after < before, "after {after} before {before}");
        let deep = run(80)[2];
        let shallow = run(5)[2];
        assert!(deep < shallow, "80 sweeps {deep} vs 5 sweeps {shallow}");
    }

    #[test]
    fn diffusion_of_a_uniform_field_changes_nothing() {
        let n = 16;
        let mut f = Fluid::new(n);
        for x in f.dens.iter_mut() {
            *x = 1.0;
        }
        f.step(0.1, 0.0, 0.5, 30);
        for j in 1..=n {
            for i in 1..=n {
                assert!((f.dens[f.ix(i, j)] - 1.0).abs() < 1e-4);
            }
        }
    }

    #[test]
    fn a_still_fluid_stays_still() {
        let mut f = Fluid::new(16);
        f.step(0.1, 0.001, 0.001, 20);
        assert_eq!(f.stats[3], 0.0);
        assert_eq!(f.stats[0], 0.0);
    }

    #[test]
    fn matches_the_shared_fixture() {
        // the wasm build must reproduce the same numbers (test/kernels-wasm.test.ts)
        let text = include_str!("../fixtures/fluids.json");
        let n: usize = field(text, "n") as usize;
        let steps: usize = field(text, "steps") as usize;
        let want = field(text, "checksum");
        let got = scenario(n, steps).checksum();
        assert!((got - want).abs() <= want.abs() * 1e-9, "checksum {got} != fixture {want}");
    }

    fn field(text: &str, key: &str) -> f64 {
        let at = text.find(&format!("\"{key}\"")).expect("key") + key.len() + 2;
        let rest = text[at..].trim_start_matches([':', ' ']);
        let end = rest.find([',', '}', '\n']).unwrap_or(rest.len());
        rest[..end].trim().parse().expect("number")
    }

    #[test]
    #[ignore = "writes the fixture; run with --ignored after changing the scenario"]
    fn write_fixture() {
        let (n, steps) = (40, 30);
        let c = scenario(n, steps).checksum();
        std::fs::write(
            concat!(env!("CARGO_MANIFEST_DIR"), "/fixtures/fluids.json"),
            format!("{{\n  \"n\": {n},\n  \"steps\": {steps},\n  \"checksum\": {c:?}\n}}\n"),
        )
        .unwrap();
    }
}
