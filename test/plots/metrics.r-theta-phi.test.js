// Regression tests for the full spherical combo (r, θ, φ) — exercises all
// three periodic-adjacent metrics together, including the θ (polar angle)
// near-pole singularity that speed/KE/phi doesn't touch.

import { describe, it, expect } from 'vitest';
import { radialVelocity, polarRate, computeMetric } from '../../src/plots/metrics.js';

describe('r/theta/phi plot: θ pole boundary (polarRate)', () => {
  // position=[0, 0, 5], velocity=[0.1, 0, 0.05] -> rho = hypot(x,y) ~ 0
  // (EPSILON-guarded), but r = 5 (well away from POLE_EPSILON), so this is
  // NOT the true-pole NaN case — confirm polarRate stays finite
  // (large-but-finite is fine; NaN/Infinity is not).
  it('polarRate stays finite when rho (cylindrical radius) approaches 0 at the pole', () => {
    const body = { position: [0, 0, 5], velocity: [0.1, 0, 0.05] };
    const result = polarRate(body);
    expect(Number.isFinite(result)).toBe(true);
  });

  // position=[1e-6, 0, 5] (near-pole, not exact) vs a slightly-less-near-pole
  // case (rho=1e-3) -- confirm the value doesn't discontinuously flip sign as
  // rho shrinks toward 0 (i.e. it's a continuous function of rho near the
  // singularity, even though it's large there).
  it('polarRate does not discontinuously flip sign as rho shrinks toward the pole', () => {
    const nearPole = polarRate({ position: [1e-3, 0, 5], velocity: [0.1, 0, 0.05] });
    const nearerPole = polarRate({ position: [1e-6, 0, 5], velocity: [0.1, 0, 0.05] });
    expect(Number.isFinite(nearPole)).toBe(true);
    expect(Number.isFinite(nearerPole)).toBe(true);
    // Same sign on both sides as rho shrinks — no discontinuous flip.
    expect(Math.sign(nearPole)).toBe(Math.sign(nearerPole));
  });

  it('polarRate returns NaN only at the true pole (r AND rho both ~0)', () => {
    const truePole = polarRate({ position: [0, 0, 0], velocity: [0.1, 0, 0.05] });
    expect(Number.isNaN(truePole)).toBe(true);
  });
});

describe('r/theta/phi plot: r -> 0 boundary (radialVelocity)', () => {
  // Same boundary as the speed/KE/phi combo's r-check — repeated here since
  // this combo plots r directly as an axis component, not just as an input
  // to a derived metric.
  it('radialVelocity stays finite as r approaches 0 (EPSILON-guarded denominator)', () => {
    const body = { position: [1e-10, 0, 0], velocity: [1, 0, 0] };
    const result = radialVelocity(body);
    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBeCloseTo(0.0909, 3);
  });
});

describe('r/theta/phi plot: φ branch-cut continuity', () => {
  // Same A/B pair as the speed/KE/phi combo (position=[-1,-0.001,0] vs
  // [-1,0.001,0]). Here phi is STILL the only periodic active slot (r and
  // theta are not periodic — theta's range is [0,π] with no branch cut, per
  // metrics.js's isPeriodicMetric/PERIODIC_METRICS), so it should still
  // become the ring slot and behave identically to the speed/KE/phi case.
  it('phi is selected as the ring slot (not theta) since theta is not periodic', async () => {
    const { isPeriodicMetric } = await import('../../src/plots/metrics.js');
    expect(isPeriodicMetric('phi')).toBe(true);
    expect(isPeriodicMetric('theta')).toBe(false);
  });

  it('embeds phi via cos/sin so the branch-cut pair lands at nearly the same ring position', () => {
    const bodyA = { position: [-1, -0.001, 0], velocity: [0, 0, 0] };
    const bodyB = { position: [-1, 0.001, 0], velocity: [0, 0, 0] };
    const phiA = computeMetric('phi', bodyA, {}, 'spherical');
    const phiB = computeMetric('phi', bodyB, {}, 'spherical');
    // Euclidean distance between the embedded ring points, not sin(phiA) ≈
    // sin(phiB) — A/B are mirror points (opposite-sign y), so their
    // y-components are correctly opposite; see metrics.speed-ke-phi.test.js
    // for the full explanation.
    const dx = Math.cos(phiA) - Math.cos(phiB);
    const dy = Math.sin(phiA) - Math.sin(phiB);
    expect(Math.hypot(dx, dy)).toBeLessThan(0.01);
  });
});
