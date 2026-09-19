import { FieldCalculator } from '@api/FieldCalculator.js';
import { G } from '@core/Simulation.js';
import { SOFTENING } from '@core/constants.js';

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

const STEP_SIZE = 0.15;
const MAX_STEPS = 200;
const TERMINATION_RADIUS = 0.3;

function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scale(v, s) {
  return [v[0] * s, v[1] * s, v[2] * s];
}

function magnitude(v) {
  return Math.hypot(v[0], v[1], v[2]);
}

function normalize(v) {
  const m = magnitude(v);
  if (m < 1e-10) return [0, 0, 0];
  return [v[0] / m, v[1] / m, v[2] / m];
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

/** Mass-weighted center of mass of `bodies`. */
function centerOfMass(bodies) {
  let mx = 0, my = 0, mz = 0, totalMass = 0;
  for (const b of bodies) {
    mx += b.position[0] * b.mass;
    my += b.position[1] * b.mass;
    mz += b.position[2] * b.mass;
    totalMass += b.mass;
  }
  if (totalMass < 1e-12) return [0, 0, 0];
  return [mx / totalMass, my / totalMass, mz / totalMass];
}

function fibonacciSpherePoint(k, n) {
  const denom = n > 1 ? n - 1 : 1; // n=1 would divide by 0; pin the single seed to the pole instead
  const yFrac = 1 - (k / denom) * 2;
  const radiusAtY = Math.sqrt(Math.max(0, 1 - yFrac * yFrac));
  const theta = GOLDEN_ANGLE * k;
  return [Math.cos(theta) * radiusAtY, yFrac, Math.sin(theta) * radiusAtY];
}

function nearestBodyDistance(position, bodies) {
  let minDist = Infinity;
  for (const b of bodies) {
    const d = magnitude(sub(position, b.position));
    minDist = Math.min(minDist, d);
  }
  return minDist;
}

export class FieldLinesCalculator extends FieldCalculator {
  /**
   * Trace gravitational field-line streamlines from seed points distributed
   * on a sphere around the bodies' center of mass.
   * @param {{position: number[], mass: number}[]} bodies
   * @param {{radius: number, count: number}} opts  radius = "sphere of draw"
   *   — both the seed-placement radius (a Fibonacci-sphere shell centered on
   *   the mass-weighted center of mass, not per-body) AND the max distance
   *   from that same center a streamline may travel before being cut off;
   *   count = total seed count, distributed via the same Fibonacci-sphere
   *   pattern used elsewhere in this codebase.
   * @returns {{seedIndex: number, points: number[][]}[]}
   */
  compute(bodies, { radius = 20, count = 24 } = {}) {
    if (bodies.length === 0) return [];

    const com = centerOfMass(bodies);
    const seedCount = Math.max(1, Math.round(count));
    const lines = [];

    for (let k = 0; k < seedCount; k++) {
      const fibPoint = fibonacciSpherePoint(k, seedCount);
      const seed = add(com, scale(fibPoint, radius));
      const seedIndex = lines.length;

      const points = [seed];
      let position = seed;

      for (let step = 0; step < MAX_STEPS; step++) {
        const accel = accelerationAt(position, bodies);
        const direction = normalize(accel);
        position = add(position, scale(direction, STEP_SIZE));
        points.push([...position]);

        const nearestDist = nearestBodyDistance(position, bodies);
        if (nearestDist < TERMINATION_RADIUS) break;

        if (magnitude(sub(position, com)) > radius) break;
      }

      lines.push({ seedIndex, points });
    }

    return lines;
  }
}
