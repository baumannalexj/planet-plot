import { FieldCalculator } from '@api/FieldCalculator.js';
import { G } from '@core/Simulation.js';
import { SOFTENING } from '@core/constants.js';

function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function length(a) {
  return Math.hypot(a[0], a[1], a[2]);
}
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
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

// Effective (Jacobi) potential in the two-primaries' rotating frame:
// Φ_eff = Σ(-Gm/r) over ALL bodies, minus the centrifugal term ½ω²(x²+y²)
// measured from the primaries' center of mass. ω comes from the primaries'
// current relative position/velocity — exact for an isolated 2-body orbit,
// an approximation once other bodies perturb it (same caveat
// LagrangePointsCalculator documents for its own L1-L5 computation).
export class JacobiPotentialCalculator extends FieldCalculator {
  compute(bodies, { extent = 20, resolution = 20, z = 0 } = {}) {
    if (bodies.length < 2) return [];

    const sorted = [...bodies].sort((a, b) => b.mass - a.mass);
    const primary = sorted[0];
    const secondary = sorted[1];

    const rVec = sub(secondary.position, primary.position);
    const r = length(rVec);
    if (r < 1e-9) return [];

    const relVel = sub(secondary.velocity ?? [0, 0, 0], primary.velocity ?? [0, 0, 0]);
    const omega = length(cross(rVec, relVel)) / (r * r);

    const totalMass = primary.mass + secondary.mass;
    const comX = (primary.position[0] * primary.mass + secondary.position[0] * secondary.mass) / totalMass;
    const comY = (primary.position[1] * primary.mass + secondary.position[1] * secondary.mass) / totalMass;

    const points = [];
    const step = (extent * 2) / (resolution - 1);
    for (let i = 0; i < resolution; i++) {
      for (let j = 0; j < resolution; j++) {
        const x = -extent + i * step;
        const y = -extent + j * step;
        const position = [x, y, z];
        const dx = x - comX;
        const dy = y - comY;
        const centrifugal = -0.5 * omega * omega * (dx * dx + dy * dy);
        const value = potentialAt(position, bodies) + centrifugal;
        points.push({ position, value });
      }
    }
    return points;
  }
}
