import { FieldCalculator } from '@api/FieldCalculator.js';
import { G } from '@core/Simulation.js';
import { SOFTENING } from '@core/constants.js';

function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function potentialAt(position, bodies) {
  let u = 0;
  for (const b of bodies) {
    const [dx, dy, dz] = sub(b.position, position);
    const r2 = dx * dx + dy * dy + dz * dz + SOFTENING * SOFTENING;
    u += -G * b.mass / Math.sqrt(r2);
  }
  return u;
}

export class PotentialFieldCalculator extends FieldCalculator {
  compute(bodies, { extent = 20, resolution = 20, z = 0 } = {}) {
    if (bodies.length === 0) return [];
    const points = [];
    const step = (extent * 2) / (resolution - 1);
    for (let i = 0; i < resolution; i++) {
      for (let j = 0; j < resolution; j++) {
        const x = -extent + i * step;
        const y = -extent + j * step;
        const position = [x, y, z];
        const value = potentialAt(position, bodies);
        points.push({ position, value });
      }
    }
    return points;
  }
}
