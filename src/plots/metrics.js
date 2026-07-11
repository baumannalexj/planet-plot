// Metric registry for the plotting panel.
//
// A "metric" is anything that can go on a plot axis: time, a derived scalar
// (speed, kinetic energy, potential energy, spherical angular rates ṙ/θ̇/φ̇),
// or a coordinate component of the selected coordinate system (x/y/z,
// rho/phi, r/theta/phi, mu/nu — see src/core/coordinates.js). Keeping this
// data-driven means adding a new derived scalar (e.g. orbit angle,
// KE-vs-velocity helpers) later is just appending to DERIVED_METRICS — no
// changes needed to the plot UI or the history/update code in plotPanel.js.

import { COORD_SYSTEMS } from '../core/coordinates.js';
import { G } from '../core/Simulation.js';

// Small epsilon to guard pairwise-distance divisions against coincident
// bodies producing Infinity/NaN.
const EPSILON = 1e-9;

// --- Unit system (see src/core/constants.js for the full derivation) -------
//
// The integrator runs in dimensionless simulation units, chosen so that
// G = 1:
//   1 length unit  (AU)  = 1 astronomical unit
//   1 mass unit    (M⊙)  = 1 solar mass
//   1 time unit    (tu)  = UNIT_TIME_DAYS ≈ 58.13 days (derived from AU/M⊙/G)
//
// `unitForMetric` below labels every plottable value in these RAW simulation
// units — it does not convert values (e.g. time is NOT converted to days).
// That keeps the unit string always matching whatever raw number the plot
// actually draws, with no separate conversion step to keep in sync.

/** Unit string for each metric id, independent of coordinate system. */
const METRIC_UNITS = {
  time: 'tu',
  speed: 'AU/tu',
  ke: 'M⊙·AU²/tu²',
  pe: 'M⊙·AU²/tu²',
  rdot: 'AU/tu',
  thetadot: 'rad/tu',
  phidot: 'rad/tu',
  // Coordinate-system axis components (from COORD_SYSTEMS[*].axes).
  x: 'AU',
  y: 'AU',
  z: 'AU',
  rho: 'AU',
  mu: 'AU',
  r: 'AU',
  theta: 'rad',
  phi: 'rad',
  nu: 'rad',
};

/**
 * Unit string for a metric, e.g. for display next to a value or on an axis
 * label. Covers both DERIVED_METRICS ids and the current coordinate
 * system's axis component ids. Returns '' for dimensionless/unknown ids.
 * @param {string} metricId
 * @param {string} [coordSystemId]  Unused for now (no id collides across
 *   coordinate systems with a different unit), kept for API symmetry with
 *   computeMetric/getMetricOptions and in case a future system needs it.
 * @returns {string}
 */
export function unitForMetric(metricId, coordSystemId) {
  void coordSystemId;
  return METRIC_UNITS[metricId] ?? '';
}

/**
 * Per-body gravitational potential energy: the interaction energy of body i
 * with all other bodies, U_i = -G * m_i * Σ_{j≠i} (m_j / r_ij).
 *
 * Pairwise distances are frame-invariant, so this is computed from the
 * absolute positions in `snapshot.bodies` rather than the origin-relative
 * `body.position` — body i is located within `snapshot.bodies` by matching
 * `body.name` (unique within a preset).
 */
function potentialEnergy(body, snapshot) {
  const bodies = snapshot.bodies;
  const i = bodies.findIndex((b) => b.name === body.name);
  if (i === -1) return NaN;
  const bi = bodies[i];
  let u = 0;
  for (let j = 0; j < bodies.length; j++) {
    if (j === i) continue;
    const bj = bodies[j];
    const dx = bi.position[0] - bj.position[0];
    const dy = bi.position[1] - bj.position[1];
    const dz = bi.position[2] - bj.position[2];
    const r = Math.hypot(dx, dy, dz) + EPSILON;
    u += bj.mass / r;
  }
  return -G * bi.mass * u;
}

/**
 * Analytical time-derivatives of spherical coordinates (r, θ, φ), computed
 * directly from a body's origin-relative position and velocity vectors —
 * exact, no numerical differencing / history needed.
 *
 * r = sqrt(x²+y²+z²), rho² = x²+y² (cylindrical radius squared).
 */
function radialVelocity(body) {
  const [x, y, z] = body.position;
  const [vx, vy, vz] = body.velocity;
  const r = Math.hypot(x, y, z) + EPSILON;
  return (x * vx + y * vy + z * vz) / r;
}

function azimuthalRate(body) {
  const [x, y] = body.position;
  const [vx, vy] = body.velocity;
  const rho2 = x * x + y * y + EPSILON;
  return (x * vy - y * vx) / rho2;
}

function polarRate(body) {
  const [x, y, z] = body.position;
  const [vx, vy, vz] = body.velocity;
  const r = Math.hypot(x, y, z) + EPSILON;
  const rho = Math.hypot(x, y) + EPSILON;
  const rdot = (x * vx + y * vy + z * vz) / r;
  return (z * rdot - vz * r) / (r * rho);
}

/**
 * Metrics that don't depend on the selected coordinate system.
 * `compute(body, snapshot)` receives a body from `snapshot.relativeBodies(origin)`.
 * @type {{id: string, label: string, compute: (body: object, snapshot: object) => number}[]}
 */
export const DERIVED_METRICS = [
  { id: 'time', label: 'Time', compute: (_body, snapshot) => snapshot.time },
  { id: 'speed', label: 'Speed |v|', compute: (body) => body.speed },
  { id: 'ke', label: 'Kinetic energy', compute: (body) => body.kineticEnergy },
  { id: 'pe', label: 'Potential energy', compute: (body, snapshot) => potentialEnergy(body, snapshot) },
  { id: 'rdot', label: 'ṙ (radial velocity)', compute: (body) => radialVelocity(body) },
  { id: 'thetadot', label: 'θ̇ (polar rate)', compute: (body) => polarRate(body) },
  { id: 'phidot', label: 'φ̇ (azimuthal rate)', compute: (body) => azimuthalRate(body) },
];

/**
 * Full list of selectable metrics for a given coordinate system: the
 * coordinate-independent ones above, plus that system's axis components.
 * @param {string} coordSystemId
 * @returns {{id: string, label: string, group: 'General'|'Coordinate'}[]}
 */
export function getMetricOptions(coordSystemId) {
  const coord = COORD_SYSTEMS[coordSystemId] ?? COORD_SYSTEMS.cartesian;
  return [
    ...DERIVED_METRICS.map((m) => ({ id: m.id, label: m.label, group: 'General' })),
    ...coord.axes.map((axis) => ({ id: axis.id, label: axis.label, group: 'Coordinate' })),
  ];
}

/**
 * Compute a metric's value for one body in one snapshot.
 * @param {string} metricId
 * @param {object} body           An entry from snapshot.relativeBodies(origin).
 * @param {object} snapshot
 * @param {string} coordSystemId
 * @returns {number}
 */
export function computeMetric(metricId, body, snapshot, coordSystemId) {
  const derived = DERIVED_METRICS.find((m) => m.id === metricId);
  if (derived) return derived.compute(body, snapshot);
  const coord = COORD_SYSTEMS[coordSystemId] ?? COORD_SYSTEMS.cartesian;
  const components = coord.convert(body.position);
  return components[metricId] ?? NaN;
}

// Metrics that are angles with an atan2-style branch cut: atan2's range is
// (-π, π], so a body crossing that cut flips from near +π to near -π (or
// vice versa) between two consecutive samples even though it moved only a
// tiny angular step. A plot connecting samples with a straight line would
// draw a spurious chord straight across the whole plot at that frame.
// plotPanel.js uses this to detect the wrap and break the polyline there
// instead. θ (spherical polar, via acos) is NOT included: its range is
// [0, π] with no discontinuity.
const PERIODIC_METRICS = new Set(['phi', 'nu']);

/** Whether a metric is an angle with an atan2-style ±π branch cut. */
export function isPeriodicMetric(metricId) {
  return PERIODIC_METRICS.has(metricId);
}
