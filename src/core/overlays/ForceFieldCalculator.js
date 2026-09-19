import { FieldCalculator } from '@api/FieldCalculator.js';
import { G } from '@core/Simulation.js';
import { SOFTENING } from '@core/constants.js';
import { computeShellGrid, decimateToLimit } from '@core/overlays/DiscretizationGrid.js';

function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

// Sums over EVERY body, unbounded — gravity has infinite range. `drawRadius`
// below only controls WHERE sample points are placed, never which bodies
// contribute to this sum.
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

export class ForceFieldCalculator extends FieldCalculator {
  /**
   * Sample the gravitational acceleration field on an adaptive spherical
   * shell grid (see DiscretizationGrid.computeShellGrid) centered on the
   * bodies' center of mass.
   * @param {{position: number[], mass: number}[]} bodies
   * @param {{drawRadius: number, radiusIterations: number, thetaIterations: number,
   *   phiIterations: number, skew: number, iconCount: number}} opts
   * @returns {{position: number[], vector: number[], magnitude: number}[]}
   */
  compute(bodies, { drawRadius = 20, radiusIterations = 12, thetaIterations = 24, phiIterations = 12, skew = 1.5, iconCount = 4096 } = {}) {
    if (bodies.length === 0) return [];
    const com = centerOfMass(bodies);
    const shellPoints = computeShellGrid(com, { drawRadius, radiusIterations, thetaIterations, phiIterations, skew, planar: false });
    const sampled = decimateToLimit(shellPoints, iconCount);

    return sampled.map(({ position }) => {
      const vector = accelerationAt(position, bodies);
      const magnitude = Math.hypot(vector[0], vector[1], vector[2]);
      return { position, vector, magnitude };
    });
  }
}
