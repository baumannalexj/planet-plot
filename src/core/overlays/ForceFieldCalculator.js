import { FieldCalculator } from '@api/FieldCalculator.js';
import { G } from '@core/Simulation.js';
import { SOFTENING } from '@core/constants.js';

function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function accelerationAt(position, bodies) {
  let ax = 0, ay = 0, az = 0;
  for (const b of bodies) {
    const [dx, dy, dz] = sub(b.position, position);
    const r2 = dx * dx + dy * dy + dz * dz + SOFTENING * SOFTENING;
    const invR3 = 1 / (r2 * Math.sqrt(r2));
    const f = G * b.mass * invR3;
    ax += f * dx;
    ay += f * dy;
    az += f * dz;
  }
  return [ax, ay, az];
}

export class ForceFieldCalculator extends FieldCalculator {
  /**
   * Sample the gravitational acceleration field on a 3D cubic grid.
   * @param {{position: number[], mass: number}[]} bodies
   * @param {{radius: number, count: number}} opts  radius = half-width of
   *   the sampled cube (AU) — user-controlled "sphere of draw" (formerly a
   *   hardcoded GRID_EXTENT constant); count = approximate total number of
   *   sample points requested. Internally distributed as a stratified grid
   *   with `round(cbrt(count))` samples per side — the actual returned
   *   length is `resolution³`, the nearest perfect cube to `count`, not
   *   `count` exactly.
   * @returns {{position: number[], vector: number[], magnitude: number}[]}
   */
  compute(bodies, { radius = 20, count = 39304 } = {}) {
    if (bodies.length === 0) return [];
    const resolution = Math.max(2, Math.round(Math.cbrt(count)));
    const points = [];
    const step = resolution > 1 ? (radius * 2) / (resolution - 1) : 0;
    for (let i = 0; i < resolution; i++) {
      for (let j = 0; j < resolution; j++) {
        for (let k = 0; k < resolution; k++) {
          const x = -radius + i * step;
          const y = -radius + j * step;
          const z = -radius + k * step;
          const position = [x, y, z];
          const vector = accelerationAt(position, bodies);
          const magnitude = Math.hypot(vector[0], vector[1], vector[2]);
          points.push({ position, vector, magnitude });
        }
      }
    }
    return points;
  }
}
