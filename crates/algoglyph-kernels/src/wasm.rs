//! The C ABI the browser calls, on `wasm32-unknown-unknown` only. No binding generator:
//! a handle, a few calls and the module's own memory, read by the caller through views.
//!
//! ```text
//!   h = ag_fluid_new(n); ag_fluid_add(h, i, j, dye, du, dv); ag_fluid_step(h, dt, visc, diff, iters)
//!   ag_fluid_density(h) -> *f32, (n+2)² cells   ag_fluid_stats(h) -> *f32, 4 values
//!   ag_fluid_checksum(h) -> f64                  ag_fluid_free(h)
//! ```

use crate::fluids::{scenario, Fluid};

#[no_mangle]
pub extern "C" fn ag_fluid_new(n: usize) -> *mut Fluid {
    Box::into_raw(Box::new(Fluid::new(n.clamp(8, 512))))
}

/// # Safety
/// `h` must come from [`ag_fluid_new`] and not have been freed.
#[no_mangle]
pub unsafe extern "C" fn ag_fluid_free(h: *mut Fluid) {
    if !h.is_null() {
        drop(Box::from_raw(h));
    }
}

/// # Safety
/// `h` must be a live handle.
#[no_mangle]
pub unsafe extern "C" fn ag_fluid_add(h: *mut Fluid, i: usize, j: usize, dye: f32, du: f32, dv: f32) {
    (*h).add(i, j, dye, du, dv);
}

/// # Safety
/// `h` must be a live handle.
#[no_mangle]
pub unsafe extern "C" fn ag_fluid_step(h: *mut Fluid, dt: f32, visc: f32, diff: f32, iters: usize) {
    (*h).step(dt, visc, diff, iters.clamp(1, 80));
}

/// # Safety
/// `h` must be a live handle.
#[no_mangle]
pub unsafe extern "C" fn ag_fluid_density(h: *mut Fluid) -> *const f32 {
    (*h).dens.as_ptr()
}

/// # Safety
/// `h` must be a live handle.
#[no_mangle]
pub unsafe extern "C" fn ag_fluid_stats(h: *mut Fluid) -> *const f32 {
    (*h).stats.as_ptr()
}

/// # Safety
/// `h` must be a live handle.
#[no_mangle]
pub unsafe extern "C" fn ag_fluid_checksum(h: *mut Fluid) -> f64 {
    (*h).checksum()
}

/// The shared scenario, run inside the module: the equivalence test compares it with the
/// native build's fixture.
#[no_mangle]
pub extern "C" fn ag_fluid_scenario_checksum(n: usize, steps: usize) -> f64 {
    scenario(n, steps).checksum()
}
