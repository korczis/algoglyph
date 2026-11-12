import { paletteParam, ramp, scale } from '../../core/palette';
import { bool, num, str, type PlateCode } from '../../core/plate';
import { cloth, step, type Cloth, type Scene } from './cloth';

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
    { kind: 'range', key: 'res', label: 'Particles per side', min: 12, max: 44, step: 2, value: 36,
      rebuild: true },
    { kind: 'range', key: 'iterations', label: 'Constraint iterations', min: 1, max: 24, step: 1,
      value: 8 },
    { kind: 'range', key: 'gravity', label: 'Gravity', min: 0, max: 3, step: 0.05, value: 1 },
    { kind: 'range', key: 'wind', label: 'Wind', min: 0, max: 3, step: 0.05, value: 0.6 },
    { kind: 'toggle', key: 'wire', label: 'Wireframe', value: false },
    paletteParam('riso'),
  ],
  pace: { kind: 'stream', emergent: 'a Verlet integrator: the cloth moves in simulated time, one step per frame' },
  create(p, ctx) {
    const params = ctx.params;
    let sheet: Cloth;
    let cols = 40;
    let rows = 40;
    let normals: Float64Array;
    let angle = 0;

    const idx = (i: number, j: number) => j * cols + i;

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
          const ux = sheet.pos[b * 3] - sheet.pos[a * 3];
          const uy = sheet.pos[b * 3 + 1] - sheet.pos[a * 3 + 1];
          const uz = sheet.pos[b * 3 + 2] - sheet.pos[a * 3 + 2];
          const vx = sheet.pos[c * 3] - sheet.pos[a * 3];
          const vy = sheet.pos[c * 3 + 1] - sheet.pos[a * 3 + 1];
          const vz = sheet.pos[c * 3 + 2] - sheet.pos[a * 3 + 2];
          const nx = uy * vz - uz * vy;
          const ny = uz * vx - ux * vz;
          const nz = ux * vy - uy * vx;
          for (const k of [a, b, c, idx(i + 1, j + 1)]) add(k, nx, ny, nz);
        }
      }
    };

    return {
      setup() {
        sheet = cloth(num(params, 'res'), str(params, 'setup') as Scene, ctx.rnd);
        cols = sheet.cols;
        rows = sheet.rows;
        normals = new Float64Array(cols * rows * 3);
        angle = 0.6;
      },
      draw() {
        const forces = {
          gravity: num(params, 'gravity') * 0.012,
          wind: num(params, 'wind') * 0.004,
          iterations: num(params, 'iterations'),
        };
        for (let s = 0; s < 2; s++) step(sheet, forces);

        p.background(...ctx.bg);
        if (!ctx.thumbnail) p.orbitControl(1, 1, 0.3);
        angle += 0.0015;
        p.rotateX(-0.3);
        p.rotateY(angle);
        const k = (Math.min(ctx.width, ctx.height) * 0.62) / rows;
        p.scale(k);

        const sphere = sheet.sphere;
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
          p.vertex(sheet.pos[q * 3], sheet.pos[q * 3 + 1], sheet.pos[q * 3 + 2]);
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
          { label: 'links', value: sheet.rest.length.toLocaleString('en') },
          { label: 'mean strain', value: `${(sheet.strain * 100).toFixed(2)} %` },
          { label: 'pinned', value: String(sheet.pinned.reduce((s, v) => s + v, 0)) },
        ]);
      },
    };
  },
};

export default verletCloth;
