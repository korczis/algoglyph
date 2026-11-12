import { mix, paletteParam, ramp } from '../../core/palette';
import { bool, num, type PlateCode } from '../../core/plate';
import { EARTH_OMEGA, PrecessionMeter, rk4, type State } from './foucault';

const PERIOD_S = 2.4;
const W0 = (2 * Math.PI) / PERIOD_S;
const DT = 1 / 240;

function hours(seconds: number): string {
  return Number.isFinite(seconds) ? `${(seconds / 3600).toFixed(1)} h` : '∞';
}

export const foucaultPendulum: PlateCode = {
  id: 'foucault-pendulum',
  mode: 'webgl',
  aspect: 16 / 10,
  thumbnailFrames: 360,
  params: [
    { kind: 'range', key: 'lat', label: 'Latitude (°)', min: -90, max: 90, step: 0.05, value: 48.85,
      rebuild: true },
    {
      kind: 'select', key: 'boost', label: 'Earth spun up', value: '3000', rebuild: true,
      options: ['1000', '3000', '6000', '10000'].map((v) => ({ value: v, label: `${Number(v).toLocaleString('en')}×` })),
    },
    { kind: 'range', key: 'amp', label: 'Amplitude (rope lengths)', min: 0.05, max: 0.3, step: 0.01,
      value: 0.22, rebuild: true },
    { kind: 'range', key: 'speed', label: 'Time per frame (×)', min: 0.25, max: 6, step: 0.25,
      value: 2 },
    { kind: 'toggle', key: 'spin', label: 'Auto-rotate camera', value: false },
    paletteParam('ember'),
  ],
  create(p, ctx) {
    const params = ctx.params;
    let s: State = [0, 0, 0, 0];
    let wz = 0;
    let t = 0;
    let meter = new PrecessionMeter();
    let trail: [number, number][] = [];
    let angle = 0;
    let lat = 0;
    let boost = 1;

    return {
      setup() {
        lat = (num(params, 'lat') * Math.PI) / 180;
        boost = Number(params.boost);
        wz = EARTH_OMEGA * boost * Math.sin(lat);
        const a = num(params, 'amp');
        // released from rest in the Earth's frame, swinging east-west
        s = [a, 0, 0, 0];
        t = 0;
        meter = new PrecessionMeter();
        trail = [];
        angle = 0.5;
      },
      draw() {
        const steps = Math.round((num(params, 'speed') * (ctx.thumbnail ? 4 : 1)) / (60 * DT));
        for (let k = 0; k < steps; k++) {
          s = rk4(s, DT, W0, wz);
          t += DT;
          meter.sample(t, s[0], s[1]);
          if (k % 2 === 0) trail.push([s[0], s[1]]);
        }
        if (trail.length > 9000) trail.splice(0, trail.length - 9000);

        const pal = ctx.palette();
        p.background(...ctx.bg);
        if (!ctx.thumbnail) p.orbitControl(1, 1, 0.3);
        if (bool(params, 'spin')) angle += 0.002;
        const L = Math.min(ctx.width, ctx.height) * 0.62;
        p.rotateX(-0.42);
        p.rotateY(angle);
        p.translate(0, L * 0.45, 0);

        // floor: compass rose in the horizontal plane (x east, z south on screen)
        p.push();
        p.rotateX(Math.PI / 2);
        p.noFill();
        p.strokeWeight(1);
        p.stroke(...mix(ctx.bg, ctx.fg, 0.22));
        const R = L * 0.34;
        p.circle(0, 0, 2 * R);
        p.circle(0, 0, 2 * R * 0.66);
        for (let d = 0; d < 72; d++) {
          const a = (d * Math.PI) / 36;
          const r0 = d % 9 === 0 ? R * 0.9 : R * 0.96;
          p.line(Math.cos(a) * r0, Math.sin(a) * r0, Math.cos(a) * R, Math.sin(a) * R);
        }
        p.pop();

        // rosette: the bob's ground track, oldest faint
        const k = L;
        p.strokeWeight(1.2);
        p.noFill();
        p.beginShape();
        for (let i = 0; i < trail.length; i++) {
          const c = ramp(pal, 0.15 + 0.85 * (i / trail.length));
          p.stroke(c[0], c[1], c[2], 40 + (200 * i) / trail.length);
          p.vertex(trail[i][0] * k, -1, -trail[i][1] * k);
        }
        p.endShape();

        // rope and bob (y points down in p5)
        const bx = s[0] * k;
        const bz = -s[1] * k;
        // the bob rests just above the floor; the pivot is fixed one rope length above that
        const pivotY = -L * 0.08 - L;
        const by = pivotY + Math.sqrt(Math.max(0, 1 - s[0] * s[0] - s[1] * s[1])) * L;
        p.stroke(...mix(ctx.bg, ctx.fg, 0.7));
        p.strokeWeight(1);
        p.line(0, pivotY, 0, bx, by, bz);
        p.push();
        p.translate(bx, by, bz);
        p.noStroke();
        p.ambientLight(70);
        p.directionalLight(255, 255, 255, -0.4, 0.8, -0.5);
        p.fill(...ramp(pal, 0.9));
        p.sphere(L * 0.035, 20, 14);
        p.pop();

        const theory = Math.abs(wz);
        const measured = Math.abs(meter.rate());
        const realPeriod = Math.abs(Math.sin(lat)) > 1e-9
          ? (2 * Math.PI) / (EARTH_OMEGA * Math.abs(Math.sin(lat))) : Infinity;
        ctx.stats([
          { label: 'precession, theory Ω·sin φ', value: theory > 0 ? `${(theory * 1000).toFixed(2)} mrad/s` : '0' },
          { label: 'precession, measured', value: Number.isNaN(measured) ? 'measuring…'
            : `${(measured * 1000).toFixed(2)} mrad/s${theory > 0 ? ` (${((100 * (measured - theory)) / theory).toFixed(2)} %)` : ''}` },
          { label: 'plane turned', value: `${((-meter.angle() * 180) / Math.PI).toFixed(1)}°` },
          { label: 'full turn on the real Earth', value: hours(realPeriod) },
        ]);
      },
    };
  },
};

export default foucaultPendulum;
