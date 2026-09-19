import { FieldCalculator } from '@api/FieldCalculator.js';

function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
function scale(a, k) {
  return [a[0] * k, a[1] * k, a[2] * k];
}
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function length(a) {
  return Math.hypot(a[0], a[1], a[2]);
}
function normalize(a) {
  const len = length(a) || 1;
  return scale(a, 1 / len);
}

function rotateAboutAxis(v, axis, angle) {
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const term1 = scale(v, cosA);
  const term2 = scale(cross(axis, v), sinA);
  const term3 = scale(axis, (1 - cosA) * (axis[0] * v[0] + axis[1] * v[1] + axis[2] * v[2]));
  return add(add(term1, term2), term3);
}

export class LagrangePointsCalculator extends FieldCalculator {
  compute(bodies) {
    if (bodies.length < 2) return [];

    const sorted = [...bodies].sort((a, b) => b.mass - a.mass);
    const primary = sorted[0];
    const secondary = sorted[1];

    const rVec = sub(secondary.position, primary.position);
    const r = length(rVec);
    if (r < 1e-9) return [];

    const unit = normalize(rVec);
    const mu = secondary.mass / (primary.mass + secondary.mass);
    const alpha = Math.cbrt(mu / 3);

    const l1 = sub(secondary.position, scale(unit, r * alpha));
    const l2 = add(secondary.position, scale(unit, r * alpha));
    const l3 = sub(primary.position, scale(unit, r * (1 + (5 * mu) / 12)));

    const relVel = sub(secondary.velocity ?? [0, 0, 0], primary.velocity ?? [0, 0, 0]);
    let normal = normalize(cross(rVec, relVel));
    if (!Number.isFinite(normal[0]) || length(normal) < 1e-9) normal = [0, 0, 1];

    const center = primary.position;
    const l4 = add(center, rotateAboutAxis(rVec, normal, Math.PI / 3));
    const l5 = add(center, rotateAboutAxis(rVec, normal, -Math.PI / 3));

    return [
      { id: 'L1', position: l1 },
      { id: 'L2', position: l2 },
      { id: 'L3', position: l3 },
      { id: 'L4', position: l4 },
      { id: 'L5', position: l5 },
    ];
  }
}
