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
   * @param {number[]} [opts.spinAxis]  Unit vector spin axis. Default [0,1,0].
   * @param {number} [opts.spinRate]    Constant spin rate, rad/tu. Default 0.
   *   Point-mass gravity exerts zero torque about a body's own center, so
   *   spin is kinematic and decoupled from Simulation's RK4 step — see
   *   .WORK_ITEMS/WORK_QUEUE.md's "Research: Rotational bodies" entry.
   */
  constructor({ name, mass, color, position, velocity, spinAxis = [0, 1, 0], spinRate = 0 }) {
    this.name = name;
    this.mass = mass;
    this.color = color;
    this.position = [...position];
    this.velocity = [...velocity];
    this.spinAxis = [...spinAxis];
    this.spinRate = spinRate;
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
