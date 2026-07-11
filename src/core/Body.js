// A single gravitating body in the simulation.
//
// State is stored as plain arrays [x, y, z] so the integrator can operate on
// flat numeric data cheaply. Rendering / plotting code should treat Body as
// read-only during a frame and read the snapshot produced by Simulation.
export class Body {
  /**
   * @param {object} opts
   * @param {string} opts.name       Display name.
   * @param {number} opts.mass       Mass (simulation units).
   * @param {string} opts.color      CSS/hex color used by viewport + plots.
   * @param {number[]} opts.position [x, y, z] initial position.
   * @param {number[]} opts.velocity [vx, vy, vz] initial velocity.
   */
  constructor({ name, mass, color, position, velocity }) {
    this.name = name;
    this.mass = mass;
    this.color = color;
    this.position = [...position];
    this.velocity = [...velocity];
  }

  /** Scalar speed |v|. */
  get speed() {
    const [vx, vy, vz] = this.velocity;
    return Math.hypot(vx, vy, vz);
  }

  /** Kinetic energy 1/2 m v^2. */
  get kineticEnergy() {
    return 0.5 * this.mass * this.speed ** 2;
  }
}
