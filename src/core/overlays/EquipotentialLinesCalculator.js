import { FieldCalculator } from '@api/FieldCalculator.js';
import { PotentialFieldCalculator } from '@core/overlays/PotentialFieldCalculator.js';
import { shellRingSizes } from '@core/overlays/DiscretizationGrid.js';

function lerpPosition(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function edgeCrossing(a, b, level) {
  if (Math.sign(a.value - level) === Math.sign(b.value - level)) return null;
  const t = (level - a.value) / (b.value - a.value);
  return lerpPosition(a.position, b.position, t);
}

function cellSegments(p00, p10, p01, p11, level) {
  const crossings = [
    edgeCrossing(p00, p10, level),
    edgeCrossing(p10, p11, level),
    edgeCrossing(p11, p01, level),
    edgeCrossing(p01, p00, level),
  ];
  const valid = crossings.filter((c) => c !== null);
  if (valid.length === 2) {
    return [[...valid[0], ...valid[1]]];
  }
  if (valid.length === 4) {
    return [
      [...crossings[0], ...crossings[1]],
      [...crossings[2], ...crossings[3]],
    ];
  }
  return [];
}

/**
 * Slice the flat `points` array PotentialFieldCalculator returns (planar
 * shell grid) back into per-shell rings, in the same order they were
 * produced — see DiscretizationGrid.shellRingSizes.
 */
function groupIntoShells(points, radiusIterations, thetaIterations, skew) {
  const ringSizes = shellRingSizes(radiusIterations, thetaIterations, skew, true);
  const shells = [];
  let offset = 0;
  for (const size of ringSizes) {
    shells.push(points.slice(offset, offset + size));
    offset += size;
  }
  return shells;
}

export class EquipotentialLinesCalculator extends FieldCalculator {
  /**
   * Marching-squares contour extraction over PotentialFieldCalculator's
   * shell-sampled (non-rectangular) grid.
   *
   * The old implementation assumed a flat rectangular
   * `points[i * resolution + j]` grid, which no longer applies now that
   * PotentialFieldCalculator samples adaptive shells of rings instead of a
   * rectangular mesh. Adjacency here is re-derived from that shell/ring
   * structure instead: within a shell, a "cell" spans two angularly-adjacent
   * points on its ring; between two adjacent shells, each point on the inner
   * ring is matched to the point at the PROPORTIONALLY nearest theta index on
   * the outer ring (ring sizes can differ between shells when skew != 0, so
   * this is an approximate nearest-angle match, not an exact geometric one).
   * This is the simpler first-pass adjacency scheme flagged as acceptable in
   * WORK_QUEUE.md Task 25 if the "real" redesign turned out bigger than
   * expected — it did, so this is what shipped. Known limitations: no cells
   * fill the very center (inside the innermost shell) or outside the
   * outermost shell, and the proportional theta-match is an approximation
   * when adjacent shells have different ring point counts.
   */
  compute(bodies, { drawRadius = 20, radiusIterations = 12, thetaIterations = 24, skew = 1.5, z = 0, levels = [] } = {}) {
    const points = new PotentialFieldCalculator().compute(bodies, { drawRadius, radiusIterations, thetaIterations, skew, z });
    if (points.length === 0) return [];

    const shells = groupIntoShells(points, radiusIterations, thetaIterations, skew);

    return levels.map((level) => {
      const segments = [];
      for (let s = 0; s < shells.length - 1; s++) {
        const ringA = shells[s];
        const ringB = shells[s + 1];
        const nA = ringA.length;
        const nB = ringB.length;
        if (nA === 0 || nB === 0) continue;
        for (let i = 0; i < nA; i++) {
          const p00 = ringA[i];
          const p10 = ringA[(i + 1) % nA];
          const j = Math.round((i / nA) * nB) % nB;
          const p01 = ringB[j];
          const p11 = ringB[(j + 1) % nB];
          segments.push(...cellSegments(p00, p10, p01, p11, level));
        }
      }
      return { level, segments };
    });
  }
}
