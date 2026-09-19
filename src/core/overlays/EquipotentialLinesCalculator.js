import { FieldCalculator } from '@api/FieldCalculator.js';
import { PotentialFieldCalculator } from '@core/overlays/PotentialFieldCalculator.js';

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

export class EquipotentialLinesCalculator extends FieldCalculator {
  compute(bodies, { extent = 20, resolution = 20, z = 0, levels = [] } = {}) {
    const points = new PotentialFieldCalculator().compute(bodies, { extent, resolution, z });
    if (points.length === 0) return [];

    return levels.map((level) => {
      const segments = [];
      for (let i = 0; i <= resolution - 2; i++) {
        for (let j = 0; j <= resolution - 2; j++) {
          const p00 = points[i * resolution + j];
          const p10 = points[(i + 1) * resolution + j];
          const p01 = points[i * resolution + (j + 1)];
          const p11 = points[(i + 1) * resolution + (j + 1)];
          segments.push(...cellSegments(p00, p10, p01, p11, level));
        }
      }
      return { level, segments };
    });
  }
}
