//! algoglyph's heavy kernels. Each is written once, here; the native tests prove its
//! invariants, and the same code compiled to `wasm32-unknown-unknown` runs in the browser
//! behind the C ABI in [`wasm`] (no binding generator, the module's own memory).

pub mod fluids;

#[cfg(target_arch = "wasm32")]
pub mod wasm;
