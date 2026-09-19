import { describe, it, expect } from 'vitest';
import { nearestBodyDistance, excludeNearBody } from '../../../src/adapters/overlays/ratchet.js';

describe('nearestBodyDistance', () => {
  it('returns the distance to the closest of several bodies', () => {
    const bodies = [{ position: [10, 0, 0] }, { position: [1, 0, 0] }, { position: [-5, 0, 0] }];
    expect(nearestBodyDistance([0, 0, 0], bodies)).toBeCloseTo(1, 9);
  });

  it('returns Infinity when there are no bodies', () => {
    expect(nearestBodyDistance([0, 0, 0], [])).toBe(Infinity);
  });

  it('returns 0 when the sample point coincides with a body', () => {
    const bodies = [{ position: [3, 4, 0] }];
    expect(nearestBodyDistance([3, 4, 0], bodies)).toBe(0);
  });
});

describe('excludeNearBody', () => {
  const bodies = [{ position: [0, 0, 0] }];

  it('excludes a sample strictly inside the exclusion radius', () => {
    expect(excludeNearBody([0.5, 0, 0], bodies, 1.0)).toBe(true);
  });

  it('does not exclude a sample outside the exclusion radius', () => {
    expect(excludeNearBody([2, 0, 0], bodies, 1.0)).toBe(false);
  });

  it('regression: a sample near r=0 no longer poisons the ratchet decision', () => {
    // The original bug: a grid resample landing this close to a body has a
    // force/potential magnitude near-blowing-up (only bounded by SOFTENING).
    // Confirm it's correctly flagged for exclusion rather than silently
    // passing through into a grow-only ratchet.
    const closeToBody = [1e-6, 0, 0];
    expect(excludeNearBody(closeToBody, bodies, 1.0)).toBe(true);
  });
});
