import { FieldCalculator } from '@api/FieldCalculator.js';
import { G } from '@core/Simulation.js';
import { SOFTENING } from '@core/constants.js';
import { computeShellGrid, decimateToLimit } from '@core/overlays/DiscretizationGrid.js';

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

// Sums over EVERY body, unbounded — gravity has infinite range. `radius`
// below is a tracing/rendering stop condition only (how far a streamline may
// travel from the CoM before we stop drawing it), never a cutoff on which
// bodies contribute to this sum.
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
   * Trace gravitational field-line streamlines from seed points placed on an
   * adaptive spherical shell grid (see DiscretizationGrid.computeShellGrid)
   * centered on the bodies' center of mass — replaces the old flat
   * Fibonacci-sphere seeding so field-line seed density follows the same
   * shell/skew schedule as the other 3 calculators.
   * @param {{position: number[], mass: number}[]} bodies
   * @param {{drawRadius: number, radiusIterations: number, thetaIterations: number,
   *   phiIterations: number, skew: number, iconCount: number}} opts  `drawRadius`
   *   is both the seed shell's outer radius and the max distance from the
   *   CoM a streamline may travel before being cut off.
   * @returns {{seedIndex: number, points: number[][]}[]}
   */
  compute(bodies, { drawRadius = 20, radiusIterations = 12, thetaIterations = 24, phiIterations = 12, skew = 1.5, iconCount = 4096 } = {}) {
    if (bodies.length === 0) return [];

    const com = centerOfMass(bodies);
    const shellPoints = computeShellGrid(com, { drawRadius, radiusIterations, thetaIterations, phiIterations, skew, planar: false });
    const seeds = decimateToLimit(shellPoints, iconCount);
    const lines = [];

    seeds.forEach(({ position: seed }, seedIndex) => {
      const points = [seed];
      let position = seed;

      for (let step = 0; step < MAX_STEPS; step++) {
        const accel = accelerationAt(position, bodies);
        const direction = normalize(accel);
        position = add(position, scale(direction, STEP_SIZE));
        points.push([...position]);

        const nearestDist = nearestBodyDistance(position, bodies);
        if (nearestDist < TERMINATION_RADIUS) break;

        if (magnitude(sub(position, com)) > drawRadius) break;
      }

      lines.push({ seedIndex, points });
    });

    return lines;
  }
}
