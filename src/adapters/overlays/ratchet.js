// Shared helper for the grow-only max/min-magnitude ratchet pattern used by
// every scalar/vector field overlay (force field, potential field,
// equipotential lines). A sample landing very close to a body has a
// force/potential magnitude that blows up toward r=0 (bounded only by the
// tiny SOFTENING constant) — feeding that into a grow-only ratchet
// permanently poisons it, collapsing the whole field toward invisible the
// next time density/resolution resamples different grid coordinates and
// happens to land near a body. Excluding near-body samples from the ratchet
// (while still rendering them, capped separately) fixes this.

/** Euclidean distance from `position` to the nearest body in `bodies`. */
export function nearestBodyDistance(position, bodies) {
  let min = Infinity;
  for (const b of bodies) {
    const dx = b.position[0] - position[0];
    const dy = b.position[1] - position[1];
    const dz = b.position[2] - position[2];
    const d = Math.hypot(dx, dy, dz);
    if (d < min) min = d;
  }
  return min;
}

/** Whether `position` is within `radius` of any body — i.e. should be excluded from a ratchet. */
export function excludeNearBody(position, bodies, radius) {
  return nearestBodyDistance(position, bodies) < radius;
}
