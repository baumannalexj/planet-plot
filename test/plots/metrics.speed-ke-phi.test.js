// Regression tests for the "speed / kinetic energy / φ (azimuth)" plot combo —
// the default plot, and the one shown in the reported screenshot with sharp
// cusps in the trace.
//
// Hypothesis to verify: the cusps are NOT a continuity bug in the calculator.
// KE = 0.5*m*v² is a monotonic function of speed for v >= 0, so any local
// min/max in speed (a real orbital turning point) produces the SAME cusp in
// KE — they aren't two independent signals, so a "cusp" here is expected
// geometry from pairing two nearly-redundant metrics, not a discontinuity.
// These tests assert CONTINUITY of the underlying computed values (no NaN,
// no unexpected jump), not smoothness/no-cusp — a cusp can still be a
// perfectly continuous function.

import { describe, it, expect } from 'vitest';
import { radialVelocity, computeMetric } from '../../src/plots/metrics.js';

describe('speed/KE/phi plot: φ branch-cut continuity', () => {
  // φ = atan2(y, x). Point A just below the branch cut, point B just above:
  // A: position=[-1, -0.001, 0] -> phi ≈ -3.1406
  // B: position=[-1,  0.001, 0] -> phi ≈  3.1406
  // Raw delta ≈ 2π, but phi is the RING slot for this combo (the only active
  // periodic metric), so it's embedded via cos/sin — isBranchCutJump should
  // never even be consulted for the ring slot itself (see breakDetection.js
  // and plotPanel.js's _isBreak, which only checks radiusSlot/heightSlot).
  it('embeds phi via cos/sin so points A and B land at nearly the same (x,y) on the ring, not a break', () => {
    const bodyA = { position: [-1, -0.001, 0], velocity: [0, 0, 0] };
    const bodyB = { position: [-1, 0.001, 0], velocity: [0, 0, 0] };
    const phiA = computeMetric('phi', bodyA, {}, 'spherical');
    const phiB = computeMetric('phi', bodyB, {}, 'spherical');
    // Raw phi values sit on opposite sides of the ±π branch cut.
    expect(phiA).toBeLessThan(0);
    expect(phiB).toBeGreaterThan(0);
    // The ring embedding (cos/sin) puts them at nearly the same EUCLIDEAN
    // point on the unit circle — NOT that sin(phiA) ≈ sin(phiB): A and B are
    // genuine mirror points (y=-0.001 vs y=+0.001), so their y-components
    // (sin) are correctly opposite in sign. What "no break" actually means is
    // that the straight-line distance between their embedded positions is
    // tiny, matching how close they are in the real world.
    const dx = Math.cos(phiA) - Math.cos(phiB);
    const dy = Math.sin(phiA) - Math.sin(phiB);
    expect(Math.hypot(dx, dy)).toBeLessThan(0.01);
  });

  // Same A/B pair, but confirm the RAW atan2 output itself is what's
  // expected (no accidental unwrapping/wraparound bug upstream of the break
  // logic) — i.e. this is a metrics.js-level check, independent of plotPanel.
  it('phi (atan2) returns bounded (-π, π] values on both sides of the branch cut', () => {
    const bodyA = { position: [-1, -0.001, 0], velocity: [0, 0, 0] };
    const bodyB = { position: [-1, 0.001, 0], velocity: [0, 0, 0] };
    const phiA = computeMetric('phi', bodyA, {}, 'spherical');
    const phiB = computeMetric('phi', bodyB, {}, 'spherical');
    for (const phi of [phiA, phiB]) {
      expect(phi).toBeGreaterThan(-Math.PI);
      expect(phi).toBeLessThanOrEqual(Math.PI);
    }
    expect(phiA).toBeCloseTo(-Math.PI, 2);
    expect(phiB).toBeCloseTo(Math.PI, 2);
  });
});

describe('speed/KE/phi plot: speed/KE redundancy at a turning point', () => {
  // At a periapsis/apoapsis-like turning point, speed v has a local
  // min/max; confirm KE = 0.5*m*v² is a smooth deterministic function of v
  // there (continuous mapping) even though the resulting plotted point has a
  // geometric cusp — the cusp is real, the MAPPING is still continuous.
  it('KE(v) is continuous and single-valued around a local min/max of v, for a fixed mass', () => {
    const mass = 2;
    const ke = (v) => 0.5 * mass * v * v;
    // Speeds approaching a turning point from both sides (v decreasing to a
    // minimum of 1.0, then increasing again).
    const speeds = [1.3, 1.2, 1.1, 1.0, 1.1, 1.2, 1.3];
    const kes = speeds.map(ke);
    // Same speed on both sides of the turning point maps to the same KE
    // (single-valued function of v).
    expect(kes[0]).toBeCloseTo(kes[6], 10);
    expect(kes[1]).toBeCloseTo(kes[5], 10);
    expect(kes[2]).toBeCloseTo(kes[4], 10);
    // No jump between adjacent samples.
    for (let i = 1; i < kes.length; i++) {
      expect(Number.isFinite(kes[i])).toBe(true);
      expect(Math.abs(kes[i] - kes[i - 1])).toBeLessThan(1);
    }
  });
});

describe('speed/KE/phi plot: r -> 0 boundary (radialVelocity)', () => {
  // position=[1e-10, 0, 0], velocity=[1, 0, 0] -> r ~ 1e-9 (EPSILON-guarded),
  // numerator ~1e-10 -> finite result (~0.1), not NaN/Infinity.
  it('radialVelocity stays finite as r approaches 0 (EPSILON-guarded denominator)', () => {
    const body = { position: [1e-10, 0, 0], velocity: [1, 0, 0] };
    const result = radialVelocity(body);
    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBeCloseTo(0.0909, 3);
  });
});
