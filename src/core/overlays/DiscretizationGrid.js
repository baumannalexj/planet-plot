// Shared adaptive spherical-shell sample-point discretization, used by all 4
// field/streamline calculators instead of each having its own grid-building
// loop. Power-law radial spacing + skew-driven per-shell density both derive
// from "shell volume ~ r^2 dr" (or ~r dr for a planar/2D ring) — see
// WORK_QUEUE.md Task 25 for the full research verdict.

export function computeShellGrid(center, { drawRadius, radiusIterations, thetaIterations, phiIterations, skew, planar = false }) {
  const points = [];
  for (let s = 1; s <= radiusIterations; s++) {
    const p = skew === 0 ? 1 : 1 / ((planar ? 2 : 3) - skew);
    const r = drawRadius * Math.pow(s / radiusIterations, p);
    const r1 = drawRadius * Math.pow(1 / radiusIterations, p);
    const falloff = skew === 0 ? 1 : Math.pow(r1 / r, skew);
    const thetaCount = Math.max(4, Math.round((skew === 0 ? thetaIterations : thetaIterations * falloff)));
    const phiCount = planar ? 1 : Math.max(4, Math.round((skew === 0 ? phiIterations : phiIterations * falloff)));
    for (let ti = 0; ti < thetaCount; ti++) {
      const theta = (ti / thetaCount) * 2 * Math.PI;
      if (planar) {
        points.push({ position: [center[0] + r * Math.cos(theta), center[1] + r * Math.sin(theta), center[2]], r });
        continue;
      }
      for (let pi = 0; pi < phiCount; pi++) {
        const phi = -Math.PI / 2 + (pi / (phiCount - 1)) * Math.PI; // -pi/2..pi/2, poles included
        const x = r * Math.cos(phi) * Math.cos(theta);
        const y = r * Math.cos(phi) * Math.sin(theta);
        const z = r * Math.sin(phi);
        points.push({ position: [center[0] + x, center[1] + y, center[2] + z], r });
      }
    }
  }
  return points; // { position:[x,y,z], r }[]
}

/**
 * Per-shell ring point counts for `planar` shell grids, in the same shell
 * order `computeShellGrid` produces them — lets a consumer slice the flat
 * `points` array it returns back into per-shell rings (needed for
 * EquipotentialLinesCalculator's marching-squares adjacency and
 * PotentialFieldOverlay's surface triangulation, neither of which can rely
 * on a flat rectangular `points[i*resolution+j]` index once sampling moved
 * from a rectangular grid to shells of rings). Mirrors `computeShellGrid`'s
 * theta-count formula exactly; independent of `drawRadius` since it cancels
 * out of the `r1/r` falloff ratio.
 */
export function shellRingSizes(radiusIterations, thetaIterations, skew, planar = true) {
  const sizes = [];
  for (let s = 1; s <= radiusIterations; s++) {
    const p = skew === 0 ? 1 : 1 / ((planar ? 2 : 3) - skew);
    const rRatio = Math.pow(s / radiusIterations, p);
    const r1Ratio = Math.pow(1 / radiusIterations, p);
    const falloff = skew === 0 ? 1 : Math.pow(r1Ratio / rRatio, skew);
    sizes.push(Math.max(4, Math.round(skew === 0 ? thetaIterations : thetaIterations * falloff)));
  }
  return sizes;
}

/**
 * Evenly stride-decimate `points` down to at most `limit` entries — the
 * `iconCount` hard render-count ceiling (Task 25). Sampling density/skew is
 * a separate knob from this; this only trims how many of the sampled points
 * actually get turned into rendered instances/lines.
 */
export function decimateToLimit(points, limit) {
  if (!Number.isFinite(limit) || limit <= 0 || points.length <= limit) return points;
  const stride = points.length / limit;
  const result = [];
  for (let i = 0; i < limit; i++) {
    result.push(points[Math.floor(i * stride)]);
  }
  return result;
}
