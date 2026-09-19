import { describe, it, expect } from 'vitest';
import { computeCircularPlan, isLargeStep, isBranchCutJump } from '../../src/plots/breakDetection.js';

describe('computeCircularPlan', () => {
  it('returns null when no active slot is periodic', () => {
    expect(computeCircularPlan(['x', 'y'], () => false)).toBeNull();
  });

  it('picks the only periodic slot as the ring, remaining slots as radius/height in order', () => {
    // Matches the default speed/KE/phi plot: x=speed, y=ke, z=phi (periodic).
    const plan = computeCircularPlan(['x', 'y', 'z'], (s) => s === 'z');
    expect(plan).toEqual({ ringSlot: 'z', radiusSlot: 'x', heightSlot: 'y' });
  });

  it('picks the first periodic slot (x > y > z priority) when more than one is periodic', () => {
    const plan = computeCircularPlan(['x', 'y', 'z'], (s) => s === 'x' || s === 'z');
    expect(plan.ringSlot).toBe('x');
    expect(plan.radiusSlot).toBe('y');
    expect(plan.heightSlot).toBe('z');
  });

  it('leaves heightSlot null when only two slots are active', () => {
    const plan = computeCircularPlan(['x', 'y'], (s) => s === 'y');
    expect(plan).toEqual({ ringSlot: 'y', radiusSlot: 'x', heightSlot: null });
  });
});

describe('isLargeStep', () => {
  it('is false for a small step below threshold', () => {
    expect(isLargeStep([0, 0, 0], [0.1, 0, 0], 0.5)).toBe(false);
  });

  it('is true for a step exceeding threshold (genuine under-sampling, not a bug)', () => {
    expect(isLargeStep([1, 0, 0], [-1, 0, 0], 0.5)).toBe(true);
  });

  it('is false exactly at the threshold (strict >, not >=)', () => {
    expect(isLargeStep([0.5, 0, 0], [0, 0, 0], 0.5)).toBe(false);
  });
});

describe('isBranchCutJump', () => {
  // The φ branch-cut pair from the screenshot investigation:
  // just-below-cut ≈ -3.1406, just-above-cut ≈ 3.1406 — raw delta ≈ 2π.
  it('detects a jump across the atan2 ±π branch cut', () => {
    expect(isBranchCutJump(-3.1406, 3.1406)).toBe(true);
  });

  it('does not flag ordinary angular motion within a frame as a jump', () => {
    expect(isBranchCutJump(0.1, 0.2)).toBe(false);
  });

  it('is false exactly at the π threshold (strict >, not >=)', () => {
    expect(isBranchCutJump(0, Math.PI)).toBe(false);
  });
});
