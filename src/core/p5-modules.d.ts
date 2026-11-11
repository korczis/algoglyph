// p5 2.x ships types for the full build only; its per-module entry points are untyped.
declare module 'p5/core' {
  import p5 from 'p5';
  export default p5;
}

declare module 'p5/*' {
  /** A p5 module registers itself onto the p5 class it is given. */
  const register: (p5: unknown) => void;
  export default register;
}
