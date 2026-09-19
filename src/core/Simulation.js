import { Body } from './Body.js';
import { config } from './Config.js';

// Gravitational constant in simulation units. Presets are tuned against G = 1.
export const G = 1.0;

/**
 * N-body gravitational simulation integrated with classic RK4.
 *
 * The simulation owns the authoritative state. Consumers (the 3D viewport and
 * the plotting panel) subscribe with `onFrame` and receive an immutable-ish
 * Snapshot after every advanced step. This is the single contract both UI
 * panels depend on — panels never mutate bodies directly.
 */
export class Simulation {
  /**
   * @param {Body[]} bodies
   * @param {object} [opts]
   * @param {number} [opts.dt]  Integration timestep.
   * @param {import('../api/logger/Logger.js').Logger} [opts.logger]  Optional — logs
   *   every emitted snapshot. No default adapter is imported here (core must
   *   not depend on @adapters); pass one from the composition root (store.js)
   *   or leave unset to log nothing.
   */
  constructor(bodies = [], { dt = 0.01, logger = null } = {}) {
    this.bodies = bodies;
    this.dt = dt;
    this.time = 0;
    this.running = true;
    this.logger = logger;
    /** @type {Set<(s: Snapshot) => void>} */
    this._listeners = new Set();
  }

  /** Replace the whole body set (e.g. when switching presets) and reset time. */
  setBodies(bodies) {
    this.bodies = bodies;
    this.time = 0;
    this.emit();
  }

  /** Subscribe to per-frame snapshots. Returns an unsubscribe fn. */
  onFrame(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  emit() {
    const snap = this.snapshot();
    // debug(), not a dedicated method: per-tick model data is exactly what
    // "debug" level means — see @api/logger/Logger.js.
    if (this.logger) this.logger.debug(snap);
    for (const l of this._listeners) l(snap);
  }

  // --- Integration ---------------------------------------------------------

  /** Flatten body state into a single [x,y,z,vx,vy,vz,...] vector. */
  _packState() {
    const s = new Float64Array(this.bodies.length * 6);
    this.bodies.forEach((b, i) => {
      const o = i * 6;
      s[o] = b.position[0];
      s[o + 1] = b.position[1];
      s[o + 2] = b.position[2];
      s[o + 3] = b.velocity[0];
      s[o + 4] = b.velocity[1];
      s[o + 5] = b.velocity[2];
    });
    return s;
  }

  _unpackState(s) {
    this.bodies.forEach((b, i) => {
      const o = i * 6;
      b.position[0] = s[o];
      b.position[1] = s[o + 1];
      b.position[2] = s[o + 2];
      b.velocity[0] = s[o + 3];
      b.velocity[1] = s[o + 4];
      b.velocity[2] = s[o + 5];
    });
  }

  // this should be an interface with an adapter (wired in main)
  /** Time derivative of the packed state vector: d/dt [pos, vel] = [vel, acc]. */
  _derivatives(s) {
    const n = this.bodies.length;
    const d = new Float64Array(n * 6);
    for (let i = 0; i < n; i++) {
      const oi = i * 6;
      // position' = velocity
      d[oi] = s[oi + 3];
      d[oi + 1] = s[oi + 4];
      d[oi + 2] = s[oi + 5];
      // velocity' = acceleration from all other bodies
      let ax = 0, ay = 0, az = 0;
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const oj = j * 6;
        const dx = s[oj] - s[oi];
        const dy = s[oj + 1] - s[oi + 1];
        const dz = s[oj + 2] - s[oi + 2];
        const r2 = dx * dx + dy * dy + dz * dz + config.softening * config.softening;
        const invR3 = 1 / (r2 * Math.sqrt(r2));
        const f = G * this.bodies[j].mass * invR3;
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

  /** Advance one RK4 step. */
  step() {
    const dt = this.dt;
    const s0 = this._packState();
    const n = s0.length;

    const k1 = this._derivatives(s0);
    const s1 = new Float64Array(n);
    for (let i = 0; i < n; i++) s1[i] = s0[i] + 0.5 * dt * k1[i];

    const k2 = this._derivatives(s1);
    const s2 = new Float64Array(n);
    for (let i = 0; i < n; i++) s2[i] = s0[i] + 0.5 * dt * k2[i];

    const k3 = this._derivatives(s2);
    const s3 = new Float64Array(n);
    for (let i = 0; i < n; i++) s3[i] = s0[i] + dt * k3[i];

    const k4 = this._derivatives(s3);
    const out = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      out[i] = s0[i] + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
    }

    this._unpackState(out);
    this.time += dt;
  }

  /** Advance `steps` sub-steps then publish one snapshot. */
  advance(steps = 1) {
    if (!this.running) return;
    for (let i = 0; i < steps; i++) this.step();
    this.emit();
  }

  /**
   * Total mechanical energy of the system: E = KE_total + U_total.
   * KE_total = Σ_i 0.5 * m_i * |v_i|^2 (raw body velocities; frame choice
   * doesn't affect a conservation check as long as it's consistent).
   * U_total = -G * Σ_{i<j} (m_i * m_j / r_ij), summed once per UNIQUE pair
   * (not double-counted like the per-body PE metric in plots/metrics.js).
   * Uses the same softened distance as the force law so this is consistent
   * with what the integrator actually evolves: a stable orbit should show
   * totalEnergy() staying roughly constant frame-to-frame (small RK4 drift
   * aside).
   */
  totalEnergy() {
    const n = this.bodies.length;
    let ke = 0;
    for (const b of this.bodies) {
      const [vx, vy, vz] = b.velocity;
      ke += 0.5 * b.mass * (vx * vx + vy * vy + vz * vz);
    }

    let u = 0;
    for (let i = 0; i < n; i++) {
      const bi = this.bodies[i];
      for (let j = i + 1; j < n; j++) {
        const bj = this.bodies[j];
        const dx = bj.position[0] - bi.position[0];
        const dy = bj.position[1] - bi.position[1];
        const dz = bj.position[2] - bi.position[2];
        const r = Math.sqrt(dx * dx + dy * dy + dz * dz + config.softening * config.softening);
        u += -G * bi.mass * bj.mass / r;
      }
    }

    return ke + u;
  }

  // --- Snapshot / reference frames ----------------------------------------

  /** Center of mass position [x,y,z]. */
  centerOfMass() {
    let mx = 0, my = 0, mz = 0, mtot = 0;
    for (const b of this.bodies) {
      mx += b.mass * b.position[0];
      my += b.mass * b.position[1];
      mz += b.mass * b.position[2];
      mtot += b.mass;
    }
    return [mx / mtot, my / mtot, mz / mtot];
  }

  /**
   * Immutable snapshot of the current frame. `origin` shifts coordinates so
   * plots/viewport can be expressed relative to the barycenter or one body.
   * @returns {Snapshot}
   */
  snapshot() {
    return new Snapshot(this);
  }
}

/**
 * A read-only view of one simulation frame. Consumers pick a reference frame
 * (origin) and read body positions/velocities relative to it.
 */
export class Snapshot {
  constructor(sim) {
    this.time = sim.time;
    // Deep-copy the numeric state so late readers see a consistent frame.
    this.bodies = sim.bodies.map((b) => ({
      name: b.name,
      mass: b.mass,
      color: b.color,
      position: [...b.position],
      velocity: [...b.velocity],
      speed: b.speed,
      kineticEnergy: b.kineticEnergy,
    }));
    this._com = sim.centerOfMass();
  }

  /**
   * Resolve the origin position for a reference-frame selector.
   * @param {'com'|number} origin  'com' for barycenter, or a body index.
   * @returns {number[]} [x,y,z]
   */
  originPosition(origin) {
    if (origin === 'com' || origin == null) return this._com;
    const b = this.bodies[origin];
    return b ? b.position : this._com;
  }

  /**
   * Body positions/velocities re-expressed relative to `origin`.
   * @param {'com'|number} origin
   */
  relativeBodies(origin) {
    const [ox, oy, oz] = this.originPosition(origin);
    // Velocity of the origin frame (0 for a fixed COM in barycentric setups,
    // but we subtract the origin body's velocity when a body is chosen).
    let ovx = 0, ovy = 0, ovz = 0;
    if (origin !== 'com' && origin != null && this.bodies[origin]) {
      [ovx, ovy, ovz] = this.bodies[origin].velocity;
    }
    return this.bodies.map((b) => {
      const position = [b.position[0] - ox, b.position[1] - oy, b.position[2] - oz];
      const velocity = [b.velocity[0] - ovx, b.velocity[1] - ovy, b.velocity[2] - ovz];
      // Recompute speed/kineticEnergy from the RELATIVE velocity — the cached
      // b.speed/b.kineticEnergy (spread via ...b below) are absolute values
      // from the Snapshot constructor and would be stale in this frame.
      const speed = Math.hypot(velocity[0], velocity[1], velocity[2]);
      const kineticEnergy = 0.5 * b.mass * speed * speed;
      return { ...b, position, velocity, speed, kineticEnergy };
    });
  }
}
