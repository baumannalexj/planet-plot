// Pure geometry/break-detection helpers extracted from PlotInstance
// (plotPanel.js) so they're unit-testable without instantiating a real plot
// (which builds a Three.js/WebGL Plot3D in its constructor). Behavior is
// unchanged from the inline versions — see plotPanel.js's _computeCircularPlan
// and _isBreak for the original context/comments.

/**
 * Decide which active axis slot (if any) becomes the periodic "ring" and
 * which become radius/height. See plotPanel.js's _computeCircularPlan for
 * the full rationale.
 * @param {('x'|'y'|'z')[]} activeSlots
 * @param {(slot: 'x'|'y'|'z') => boolean} isPeriodicSlot
 * @returns {{ringSlot: 'x'|'y'|'z', radiusSlot: ('x'|'y'|'z')|null, heightSlot: ('x'|'y'|'z')|null} | null}
 */
export function computeCircularPlan(activeSlots, isPeriodicSlot) {
  const periodicSlots = activeSlots.filter(isPeriodicSlot);
  if (periodicSlots.length === 0) return null;
  const ringSlot = periodicSlots[0];
  const otherSlots = activeSlots.filter((s) => s !== ringSlot);
  return { ringSlot, radiusSlot: otherSlots[0] ?? null, heightSlot: otherSlots[1] ?? null };
}

/** Euclidean distance between two normalized 3D points exceeds `threshold`. */
export function isLargeStep(point, prevPoint, threshold) {
  const dx = point[0] - prevPoint[0];
  const dy = point[1] - prevPoint[1];
  const dz = point[2] - prevPoint[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz) > threshold;
}

/**
 * Whether two consecutive RAW (unembedded) angle samples flipped across the
 * atan2 ±π branch cut. Only meaningful for a periodic metric that ISN'T the
 * ring slot (the ring slot is embedded via cos/sin and never needs this).
 */
export function isBranchCutJump(prevRawValue, rawValue) {
  return Math.abs(rawValue - prevRawValue) > Math.PI;
}
