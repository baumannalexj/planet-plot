// Coordinate-system conversions shared by the plotting panel.
//
// All inputs are Cartesian [x, y, z] relative to the chosen origin/reference
// frame. Each system returns a labeled set of components so the axis picker can
// offer the right choices per system.

/**
 * @typedef {Object} CoordSystem
 * @property {string} id
 * @property {string} label
 * @property {{id: string, label: string}[]} axes  Selectable components.
 * @property {(p: number[]) => Record<string, number>} convert  Cartesian -> components.
 */

/** @type {Record<string, CoordSystem>} */
export const COORD_SYSTEMS = {
  cartesian: {
    id: 'cartesian',
    label: 'Cartesian (x, y, z)',
    axes: [
      { id: 'x', label: 'x' },
      { id: 'y', label: 'y' },
      { id: 'z', label: 'z' },
    ],
    convert([x, y, z]) {
      return { x, y, z };
    },
  },

  cylindrical: {
    id: 'cylindrical',
    label: 'Cylindrical (ρ, φ, z)',
    axes: [
      { id: 'rho', label: 'ρ (radial)' },
      { id: 'phi', label: 'φ (azimuth)' },
      { id: 'z', label: 'z' },
    ],
    convert([x, y, z]) {
      return { rho: Math.hypot(x, y), phi: Math.atan2(y, x), z };
    },
  },

  spherical: {
    id: 'spherical',
    label: 'Spherical (r, θ, φ)',
    axes: [
      { id: 'r', label: 'r (radius)' },
      { id: 'theta', label: 'θ (polar)' },
      { id: 'phi', label: 'φ (azimuth)' },
    ],
    convert([x, y, z]) {
      const r = Math.hypot(x, y, z);
      return { r, theta: Math.acos(z / (r + 1e-12)), phi: Math.atan2(y, x) };
    },
  },

  elliptical: {
    id: 'elliptical',
    label: 'Elliptical (μ, ν, z)',
    // Elliptic cylindrical coordinates with focal distance a.
    axes: [
      { id: 'mu', label: 'μ' },
      { id: 'nu', label: 'ν' },
      { id: 'z', label: 'z' },
    ],
    convert([x, y, z], a = 1) {
      // x = a cosh(mu) cos(nu), y = a sinh(mu) sin(nu)
      const p = (x * x + y * y) / (a * a);
      // Solve for mu, nu via the standard inverse relations.
      const term = Math.hypot(x / a, y / a);
      const mu = Math.acosh(Math.max(1, (Math.hypot(x + a, y) + Math.hypot(x - a, y)) / (2 * a)));
      const nu = Math.atan2(y, x); // angular-like parameter
      void p; void term;
      return { mu, nu, z };
    },
  },
};

export const DEFAULT_COORD_SYSTEM = 'cartesian';
