import { ForceLaw } from '@api/ForceLaw.js';

// Matches Simulation.js's G — presets are tuned against G = 1. Not imported
// from there: Simulation.js imports THIS file for its default force law, so
// importing back would be a circular dependency.
const G = 1.0;

/**
 * Default force law: softened Newtonian gravity, summed over ALL bodies —
 * no distance cutoff (physics invariant, see .WORK_ITEMS/WORK_ITEMS_RULES.md). Same body
 * as Simulation's former private `_derivatives()`, adapted to the
 * `derivatives(state, bodies, softening)` interface shape.
 */
export class NewtonianForceLaw extends ForceLaw {
  derivatives(state, bodies, softening) {
    const n = bodies.length;
    const d = new Float64Array(n * 6);
    for (let i = 0; i < n; i++) {
      const oi = i * 6;
      // position' = velocity
      d[oi] = state[oi + 3];
      d[oi + 1] = state[oi + 4];
      d[oi + 2] = state[oi + 5];
      // velocity' = acceleration from all other bodies
      let ax = 0, ay = 0, az = 0;
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const oj = j * 6;
        const dx = state[oj] - state[oi];
        const dy = state[oj + 1] - state[oi + 1];
        const dz = state[oj + 2] - state[oi + 2];
        const r2 = dx * dx + dy * dy + dz * dz + softening * softening;
        const invR3 = 1 / (r2 * Math.sqrt(r2));
        const f = G * bodies[j].mass * invR3;
        ax += f * dx;
        ay += f * dy;
        az += f * dz;
      }
      d[oi + 3] = ax;
      d[oi + 4] = ay;
      d[oi + 5] = az;
    }
    return d;
  }
}
