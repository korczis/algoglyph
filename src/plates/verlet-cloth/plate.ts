import { paletteParam, ramp, scale } from '../../core/palette';
import { bool, num, str, type PlateCode } from '../../core/plate';

interface Link {
  a: number;
  b: number;
  rest: number;
}

export const verletCloth: PlateCode = {
  id: 'verlet-cloth',
  mode: 'webgl',
  aspect: 16 / 10,
  thumbnailFrames: 200,
  params: [
    {
      kind: 'select', key: 'setup', label: 'Scene', value: 'drape', rebuild: true,
      options: [
        { value: 'drape', label: 'Drop over a sphere' },
        { value: 'curtain', label: 'Curtain (top edge pinned)' },
        { value: 'corners', label: 'Hammock (two corners)' },
      ],
    },
    { kind: 'range', key: 'res', label: 'Particles per side', min: 12, max: 56, step: 2, value: 40,
      rebuild: true },
    { kind: 'range', key: 'iterations', label: 'Constraint iterations', min: 1, max: 24, step: 1,
      value: 8 },
    { kind: 'range', key: 'gravity', label: 'Gravity', min: 0, max: 3, step: 0.05, value: 1 },
    { kind: 'range', key: 'wind', label: 'Wind', min: 0, max: 3, step: 0.05, value: 0.6 },
    { kind: 'toggle', key: 'wire', label: 'Wireframe', value: false },
    paletteParam('riso'),
  ],
  create(p, ctx) {
    const params = ctx.params;
    let cols = 40;
    let rows = 40;
    let pos: Float64Array;
    let prev: Float64Array;
    let pinned: Uint8Array;
    let normals: Float64Array;
    let links: Link[] = [];
    let sphere: { x: number; y: number; z: number; r: number } | null = null;
    let floor = 0;
    let t = 0;
    let angle = 0;
    let strain = 0;

    const idx = (i: number, j: number) => j * cols + i;

    const relax = () => {
      let sum = 0;
      for (const l of links) {
        const a = l.a * 3;
        const b = l.b * 3;
        const dx = pos[b] - pos[a];
        const dy = pos[b + 1] - pos[a + 1];
        const dz = pos[b + 2] - pos[a + 2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-9;
        const diff = (d - l.rest) / d;
        sum += Math.abs(d - l.rest) / l.rest;
        const wa = pinned[l.a] ? 0 : pinned[l.b] ? 1 : 0.5;
        const wb = pinned[l.b] ? 0 : pinned[l.a] ? 1 : 0.5;
        pos[a] += dx * diff * wa;
        pos[a + 1] += dy * diff * wa;
        pos[a + 2] += dz * diff * wa;
        pos[b] -= dx * diff * wb;
        pos[b + 1] -= dy * diff * wb;
        pos[b + 2] -= dz * diff * wb;
      }
      return sum / links.length;
    };

    const collide = () => {
      for (let k = 0; k < cols * rows; k++) {
        const o = k * 3;
        if (sphere) {
          const dx = pos[o] - sphere.x;
          const dy = pos[o + 1] - sphere.y;
          const dz = pos[o + 2] - sphere.z;
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
          const r = sphere.r * 1.03;
          if (d < r && d > 0) {
            const s = r / d;
            pos[o] = sphere.x + dx * s;
            pos[o + 1] = sphere.y + dy * s;
            pos[o + 2] = sphere.z + dz * s;
          }
        }
        if (pos[o + 1] > floor) {
          pos[o + 1] = floor;
          // friction on the floor: lose most of the tangential motion
          prev[o] = pos[o] - (pos[o] - prev[o]) * 0.2;
          prev[o + 2] = pos[o + 2] - (pos[o + 2] - prev[o + 2]) * 0.2;
        }
      }
    };

    const computeNormals = () => {
      normals.fill(0);
      const add = (k: number, nx: number, ny: number, nz: number) => {
        normals[k * 3] += nx;
        normals[k * 3 + 1] += ny;
        normals[k * 3 + 2] += nz;
      };
      for (let j = 0; j < rows - 1; j++) {
        for (let i = 0; i < cols - 1; i++) {
          const a = idx(i, j);
          const b = idx(i + 1, j);
          const c = idx(i, j + 1);
          const ux = pos[b * 3] - pos[a * 3];
          const uy = pos[b * 3 + 1] - pos[a * 3 + 1];
          const uz = pos[b * 3 + 2] - pos[a * 3 + 2];
          const vx = pos[c * 3] - pos[a * 3];
          const vy = pos[c * 3 + 1] - pos[a * 3 + 1];
          const vz = pos[c * 3 + 2] - pos[a * 3 + 2];
          const nx = uy * vz - uz * vy;
          const ny = uz * vx - ux * vz;
          const nz = ux * vy - uy * vx;
          for (const k of [a, b, c, idx(i + 1, j + 1)]) add(k, nx, ny, nz);
        }
      }
    };

    return {
      setup() {
        cols = rows = num(params, 'res');
        const n = cols * rows;
        pos = new Float64Array(n * 3);
        prev = new Float64Array(n * 3);
        normals = new Float64Array(n * 3);
        pinned = new Uint8Array(n);
        const scene = str(params, 'setup');
        const top = -rows * 0.55;
        for (let j = 0; j < rows; j++) {
          for (let i = 0; i < cols; i++) {
            const k = idx(i, j) * 3;
            pos[k] = i - (cols - 1) / 2;
            if (scene === 'drape') {
              pos[k + 1] = top - 2;
              pos[k + 2] = j - (rows - 1) / 2;
            } else {
              // hung horizontally, so it swings down when released
              pos[k + 1] = top;
              pos[k + 2] = j;
            }
          }
        }
        // a tiny seeded wrinkle breaks the symmetry of a perfectly flat sheet
        for (let k = 0; k < n * 3; k++) pos[k] += (ctx.rnd() - 0.5) * 0.02;
        prev.set(pos);
        if (scene === 'curtain') for (let i = 0; i < cols; i++) pinned[idx(i, 0)] = 1;
        if (scene === 'corners') {
          pinned[idx(0, 0)] = 1;
          pinned[idx(cols - 1, 0)] = 1;
        }
        sphere = scene === 'drape' ? { x: 0, y: top + rows * 0.42, z: 0, r: rows * 0.24 } : null;
        floor = top + rows * 1.15;
        links = [];
        const link = (a: number, b: number) => {
          const dx = pos[b * 3] - pos[a * 3];
          const dy = pos[b * 3 + 1] - pos[a * 3 + 1];
          const dz = pos[b * 3 + 2] - pos[a * 3 + 2];
          links.push({ a, b, rest: Math.sqrt(dx * dx + dy * dy + dz * dz) });
        };
        for (let j = 0; j < rows; j++) {
          for (let i = 0; i < cols; i++) {
            if (i < cols - 1) link(idx(i, j), idx(i + 1, j));
            if (j < rows - 1) link(idx(i, j), idx(i, j + 1));
            if (i < cols - 1 && j < rows - 1) {
              link(idx(i, j), idx(i + 1, j + 1));
              link(idx(i + 1, j), idx(i, j + 1));
            }
          }
        }
        t = 0;
        angle = 0.6;
      },
      draw() {
        const g = num(params, 'gravity') * 0.012;
        const wind = num(params, 'wind') * 0.004;
        const iterations = num(params, 'iterations');
        for (let s = 0; s < 2; s++) {
          t += 1;
          for (let k = 0; k < cols * rows; k++) {
            if (pinned[k]) continue;
            const o = k * 3;
            const gust = wind * (0.6 + 0.4 * Math.sin(t * 0.021 + pos[o] * 0.15 + pos[o + 1] * 0.1));
            for (let d = 0; d < 3; d++) {
              const x = pos[o + d];
              const acc = d === 1 ? g : d === 2 ? gust : 0;
              pos[o + d] = x + (x - prev[o + d]) * 0.995 + acc;
              prev[o + d] = x;
            }
          }
          for (let it = 0; it < iterations; it++) {
            strain = relax();
            collide();
          }
        }

        p.background(...ctx.bg);
        if (!ctx.thumbnail) p.orbitControl(1, 1, 0.3);
        angle += 0.0015;
        p.rotateX(-0.3);
        p.rotateY(angle);
        const k = (Math.min(ctx.width, ctx.height) * 0.62) / rows;
        p.scale(k);

        if (sphere) {
          p.push();
          p.translate(sphere.x, sphere.y, sphere.z);
          p.noFill();
          p.stroke(ctx.fg[0], ctx.fg[1], ctx.fg[2], 38);
          p.strokeWeight(1);
          p.sphere(sphere.r, 18, 12);
          p.pop();
        }

        const pal = ctx.palette();
        computeNormals();
        const wire = bool(params, 'wire');
        const L = [0.35, -0.8, 0.5];
        const shade = (q: number) => {
          const nx = normals[q * 3];
          const ny = normals[q * 3 + 1];
          const nz = normals[q * 3 + 2];
          const len = Math.hypot(nx, ny, nz) || 1;
          const lambert = Math.abs((nx * L[0] + ny * L[1] + nz * L[2]) / len);
          return 0.28 + 0.78 * lambert;
        };
        if (wire) {
          p.noFill();
          p.strokeWeight(1);
        } else p.noStroke();
        p.beginShape(p.TRIANGLES);
        const vtx = (q: number) => {
          const u = (q % cols) / (cols - 1);
          const v = Math.floor(q / cols) / (rows - 1);
          const stripe = Math.floor(v * 8) % 2 === 0 ? 1 : 0.86;
          const c = scale(ramp(pal, u), shade(q) * stripe);
          if (wire) p.stroke(c[0], c[1], c[2], 200);
          else p.fill(c[0], c[1], c[2]);
          p.vertex(pos[q * 3], pos[q * 3 + 1], pos[q * 3 + 2]);
        };
        for (let j = 0; j < rows - 1; j++) {
          for (let i = 0; i < cols - 1; i++) {
            const a = idx(i, j);
            const b = idx(i + 1, j);
            const c = idx(i, j + 1);
            const d = idx(i + 1, j + 1);
            vtx(a);
            vtx(b);
            vtx(d);
            vtx(a);
            vtx(d);
            vtx(c);
          }
        }
        p.endShape();

        ctx.stats([
          { label: 'particles', value: String(cols * rows) },
          { label: 'links', value: links.length.toLocaleString('en') },
          { label: 'mean strain', value: `${(strain * 100).toFixed(2)} %` },
          { label: 'pinned', value: String(pinned.reduce((s, v) => s + v, 0)) },
        ]);
      },
    };
  },
};

export default verletCloth;
