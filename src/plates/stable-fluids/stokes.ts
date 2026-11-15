// Stokes's theorem on the solver's grid, as two sums that share no term in the code: the
// circulation ∮v·dl around a rectangle of cells, along their outer faces, and the flux of the
// vorticity ω = ∂v/∂x − ∂u/∂y through it, each ω by central differences at a cell centre. The
// field lives on an (n+2)² grid with a one-cell border, cell (i, j) at i + (n+2)·j, spacing
// h = 1/n, i along x and j along y. Summing ω·h² over the cells telescopes in each row and
// column: what is left are the averages of neighbouring cells on the rectangle's faces, which
// is the circulation by the midpoint rule along each face. So the two agree to rounding:
// Feynman's proof of the theorem, the inner edges of the little squares cancelling, on a grid.

/** Cells a..b along x and c..d along y, interior indices from 1 to n. */
export interface Loop {
  a: number;
  b: number;
  c: number;
  d: number;
}

/** The centred square whose side is `fraction` of the box, in whole cells, at least 2 a side. */
export function centredLoop(n: number, fraction: number): Loop {
  const side = Math.max(2, Math.min(n - 2, Math.round(fraction * n)));
  const a = 1 + Math.floor((n - side) / 2);
  return { a, b: a + side - 1, c: a, d: a + side - 1 };
}

export interface Stokes {
  /** ∮v·dl along the faces, oriented as ω's sign (from +x towards +y). */
  circulation: number;
  /** ∬ω dA over the cells. */
  flux: number;
  /** |circulation − flux| over the sum of the absolute terms of both: rounding only. */
  gap: number;
}

export function stokes(n: number, u: ArrayLike<number>, v: ArrayLike<number>, loop: Loop): Stokes {
  const w = n + 2;
  const h = 1 / n;
  const { a, b, c, d } = loop;
  // the line: up the right face (x = b + ½), back down the left (x = a − ½), then the top and
  // bottom faces along x, each face value the mean of the two cells it separates
  let circulation = 0;
  let size = 0;
  for (let j = c; j <= d; j++) {
    const right = ((v[b + w * j] + v[b + 1 + w * j]) / 2) * h;
    const left = ((v[a - 1 + w * j] + v[a + w * j]) / 2) * h;
    circulation += right - left;
    size += Math.abs(right) + Math.abs(left);
  }
  for (let i = a; i <= b; i++) {
    const top = ((u[i + w * d] + u[i + w * (d + 1)]) / 2) * h;
    const bottom = ((u[i + w * (c - 1)] + u[i + w * c]) / 2) * h;
    circulation -= top - bottom;
    size += Math.abs(top) + Math.abs(bottom);
  }
  // the area: the central-difference curl at each cell centre, times the cell's area
  let flux = 0;
  for (let j = c; j <= d; j++) {
    for (let i = a; i <= b; i++) {
      const dvdx = (v[i + 1 + w * j] - v[i - 1 + w * j]) / (2 * h);
      const dudy = (u[i + w * (j + 1)] - u[i + w * (j - 1)]) / (2 * h);
      const term = (dvdx - dudy) * h * h;
      flux += term;
      size += Math.abs(term);
    }
  }
  return { circulation, flux, gap: size > 0 ? Math.abs(circulation - flux) / size : 0 };
}
