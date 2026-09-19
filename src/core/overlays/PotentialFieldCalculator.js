import { FieldCalculator } from '@api/FieldCalculator.js';
import { G } from '@core/Simulation.js';
import { SOFTENING } from '@core/constants.js';
import { computeShellGrid } from '@core/overlays/DiscretizationGrid.js';

function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

// Sums over EVERY body, unbounded — gravity has infinite range. `drawRadius`
// below only controls WHERE sample points are placed, never which bodies
// contribute to this sum.
function potentialAt(position, bodies) {
  let u = 0;
  for (const b of bodies) {
    const [dx, dy, dz] = sub(b.position, position);
    const r2 = dx * dx + dy * dy + dz * dz + SOFTENING * SOFTENING;
    u += -G * b.mass / Math.sqrt(r2);
  }
  return u;
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

export class PotentialFieldCalculator extends FieldCalculator {
  /**
   * Sample gravitational potential U on a single z-plane, using a `planar`
   * (theta-ring only, no phi loop) adaptive shell grid centered on the
   * bodies' center of mass — see DiscretizationGrid.computeShellGrid.
   *
   * NOTE: deliberately does NOT accept/apply `iconCount` — unlike
   * ForceField/FieldLines (discrete instanced glyphs), this feeds a
   * continuous surface mesh AND EquipotentialLinesCalculator's marching
   * squares, both of which need the full, structurally-predictable
   * shell/ring layout (see shellRingSizes) to reconstruct adjacency.
   * Decimating here would desync that structure.
   * @param {{position: number[], mass: number}[]} bodies
   * @param {{drawRadius: number, radiusIterations: number, thetaIterations: number,
   *   skew: number, z: number}} opts
   * @returns {{position: number[], value: number, r: number}[]}
   */
  compute(bodies, { drawRadius = 20, radiusIterations = 12, thetaIterations = 24, skew = 1.5, z = 0 } = {}) {
    if (bodies.length === 0) return [];
    const com = centerOfMass(bodies);
    const center = [com[0], com[1], z];
    const shellPoints = computeShellGrid(center, { drawRadius, radiusIterations, thetaIterations, phiIterations: 0, skew, planar: true });

    return shellPoints.map(({ position, r }) => ({ position, value: potentialAt(position, bodies), r }));
  }
}
