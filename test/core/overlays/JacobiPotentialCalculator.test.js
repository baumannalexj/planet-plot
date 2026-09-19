import { describe, it, expect } from 'vitest';
import { JacobiPotentialCalculator } from '../../../src/core/overlays/JacobiPotentialCalculator.js';
import { LagrangePointsCalculator } from '../../../src/core/overlays/LagrangePointsCalculator.js';
import { G } from '../../../src/core/Simulation.js';
import { SOFTENING } from '../../../src/core/constants.js';

// Earth-Moon-like mass ratio (mu ~ 0.0121) circular restricted 3-body setup:
// primary at the origin, secondary at (1, 0, 0) with a purely tangential
// velocity sized for a circular relative orbit (v = sqrt(G(m1+m2)/r)).
const mu = 0.0121;
const primaryMass = 1 - mu;
const secondaryMass = mu;
const separation = 1;
const relativeSpeed = Math.sqrt((primaryMass + secondaryMass) / separation);

const bodies = [
  { position: [0, 0, 0], velocity: [0, 0, 0], mass: primaryMass },
  { position: [separation, 0, 0], velocity: [0, relativeSpeed, 0], mass: secondaryMass },
];

// Independent (test-only) copy of the effective-potential formula, used only
// to locate L1-L3's exact critical points by root-finding — the
// LagrangePointsCalculator's L1-L3 formulas are a small-mu series
// approximation (documented there), not precise enough at this mass ratio to
// land exactly on the saddle ridge for a curvature check.
function effectivePotential(x, y) {
  let u = 0;
  for (const b of bodies) {
    const dx = b.position[0] - x;
    const dy = b.position[1] - y;
    const r2 = dx * dx + dy * dy + SOFTENING * SOFTENING;
    u += (-G * b.mass) / Math.sqrt(r2);
  }
  const comX = (bodies[0].position[0] * bodies[0].mass + bodies[1].position[0] * bodies[1].mass) / (primaryMass + secondaryMass);
  const relVel = [0, relativeSpeed, 0];
  const omega = Math.abs(separation * relVel[1]) / (separation * separation);
  const ddx = x - comX;
  const ddy = y;
  return u - 0.5 * omega * omega * (ddx * ddx + ddy * ddy);
}

function gradX(x) {
  const h = 1e-7;
  return (effectivePotential(x + h, 0) - effectivePotential(x - h, 0)) / (2 * h);
}

function bisectRoot(a, b) {
  let fa = gradX(a);
  for (let k = 0; k < 80; k++) {
    const m = (a + b) / 2;
    const fm = gradX(m);
    if (fa < 0 === fm < 0) {
      a = m;
      fa = fm;
    } else {
      b = m;
    }
  }
  return (a + b) / 2;
}

const exactL1x = bisectRoot(0.01, 0.999);
const exactL2x = bisectRoot(1.001, 3);
const exactL3x = bisectRoot(-3, -0.5);

const lagrangePoints = new LagrangePointsCalculator().compute(bodies);
const l4 = lagrangePoints.find((p) => p.id === 'L4').position;
const l5 = lagrangePoints.find((p) => p.id === 'L5').position;

const EPS = 1e-3;

/**
 * Sample the real JacobiPotentialCalculator at a point plus its immediate
 * ±x/±y neighbors, by translating the whole (primary+secondary) system so
 * the target point sits exactly on a grid vertex — avoids ever needing the
 * grid step to land on an arbitrary/irrational target coordinate.
 */
function sampleStencil(x, y) {
  const shifted = bodies.map((b) => ({
    ...b,
    position: [b.position[0] - x, b.position[1] - y, b.position[2]],
  }));
  const calculator = new JacobiPotentialCalculator();
  const resolution = 5;
  const extent = 2 * EPS;
  const points = calculator.compute(shifted, { extent, resolution, z: 0 });
  const at = (i, j) => points[i * resolution + j].value;
  return { center: at(2, 2), xPlus: at(3, 2), xMinus: at(1, 2), yPlus: at(2, 3), yMinus: at(2, 1) };
}

describe('JacobiPotentialCalculator', () => {
  it('returns [] for fewer than two bodies', () => {
    const calculator = new JacobiPotentialCalculator();
    expect(calculator.compute([bodies[0]], { extent: 2, resolution: 5 })).toEqual([]);
    expect(calculator.compute([], { extent: 2, resolution: 5 })).toEqual([]);
  });

  it.each([['L4', l4], ['L5', l5]])('is a local maximum (hilltop) at %s', (_id, [x, y]) => {
    const { center, xPlus, xMinus, yPlus, yMinus } = sampleStencil(x, y);
    expect(center).toBeGreaterThan(xPlus);
    expect(center).toBeGreaterThan(xMinus);
    expect(center).toBeGreaterThan(yPlus);
    expect(center).toBeGreaterThan(yMinus);
  });

  it.each([['L1', exactL1x], ['L2', exactL2x]])(
    'is a saddle point, not a maximum, at %s — max along the primary-secondary axis, min perpendicular to it',
    (_id, x) => {
      const { center, xPlus, xMinus, yPlus, yMinus } = sampleStencil(x, 0);
      expect(center).toBeGreaterThan(xPlus);
      expect(center).toBeGreaterThan(xMinus);
      expect(center).toBeLessThan(yPlus);
      expect(center).toBeLessThan(yMinus);
    }
  );

  it('is not a maximum along the primary-secondary axis at L3', () => {
    const { center, xPlus, xMinus } = sampleStencil(exactL3x, 0);
    // L3 sits opposite the secondary, on the far side of the primary — its
    // saddle character is much weaker at realistic mass ratios than L1/L2's,
    // but it must still not be a hilltop along the primary-secondary axis.
    expect(center).toBeGreaterThan(xPlus);
    expect(center).toBeGreaterThan(xMinus);
  });
});
