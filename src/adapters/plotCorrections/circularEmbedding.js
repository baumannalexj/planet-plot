import { PlotCorrectionStrategy } from '@api/PlotCorrectionStrategy.js';
import { computeCircularPlan, isLargeStep, isBranchCutJump } from '@plots/breakDetection.js';
import { CIRCULAR_R0, CIRCULAR_RK } from '@plots/plot3d.js';

export class CircularEmbeddingCorrection extends PlotCorrectionStrategy {
  computePlan(activeSlots, isPeriodicSlot) {
    return computeCircularPlan(activeSlots, isPeriodicSlot);
  }

  buildPoint({ buf, idx, bounds, plan, normalize }) {
    if (!plan) {
      return [
        normalize(buf.x[idx], bounds.x),
        normalize(buf.y[idx], bounds.y),
        bounds.z ? normalize(buf.z[idx], bounds.z) : 0,
      ];
    }
    const rawAngle = buf[plan.ringSlot][idx];
    const angle = Number.isFinite(rawAngle) ? rawAngle : 0;
    const radiusN = plan.radiusSlot ? normalize(buf[plan.radiusSlot][idx], bounds[plan.radiusSlot]) : 0;
    const radius = CIRCULAR_R0 + radiusN * CIRCULAR_RK;
    const height = plan.heightSlot ? normalize(buf[plan.heightSlot][idx], bounds[plan.heightSlot]) : 0;

    const point = { x: 0, y: 0, z: 0 };
    point[plan.ringSlot] = Math.cos(angle) * radius;
    if (plan.radiusSlot) point[plan.radiusSlot] = Math.sin(angle) * radius;
    if (plan.heightSlot) point[plan.heightSlot] = height;
    return [point.x, point.y, point.z];
  }

  isBreak({ buf, idx, point, prevPoint, plan, isPeriodicSlot, threshold }) {
    if (isLargeStep(point, prevPoint, threshold)) return true;
    if (!plan) return false;
    for (const slot of [plan.radiusSlot, plan.heightSlot]) {
      if (!slot || !isPeriodicSlot(slot)) continue;
      if (isBranchCutJump(buf[slot][idx - 1], buf[slot][idx])) return true;
    }
    return false;
  }
}
