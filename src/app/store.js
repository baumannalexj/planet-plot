// Shared application state + wiring between the simulation core and UI panels.
//
// Both panels (viewport + plots) depend ONLY on this store and the core
// Simulation snapshot — never on each other. This keeps the two work streams
// decoupled and is the seam we'd later formalize into hex-style ports.

import { Simulation } from '../core/Simulation.js';
import { PRESETS, DEFAULT_PRESET } from '../core/presets.js';

// Sim-speed factor: how many integrator sub-steps (each of fixed dt) the sim
// advances per animation frame, on average. Discrete steps spanning slow
// motion (1/100x) up to fast-forward (16x). Kept as a *factor* on step count
// (rather than scaling dt) so RK4 accuracy is unaffected at any speed.
export const SPEED_FACTORS = [0.01, 0.1, 0.25, 0.5, 1, 2, 4, 8, 16];
export const DEFAULT_SPEED_INDEX = SPEED_FACTORS.indexOf(0.5); // start at half speed
export const MIN_SPEED_FACTOR = SPEED_FACTORS[0];
export const MAX_SPEED_FACTOR = SPEED_FACTORS[SPEED_FACTORS.length - 1];

// Energy-drift alarm: how many ticks between checks (avoid recomputing
// totalEnergy() every frame) and how large a *relative* change from the
// baseline energy counts as "badly broken" (a real integration blow-up,
// not ordinary tiny RK4 drift). Tunable in one place.
export const ENERGY_CHECK_INTERVAL_TICKS = 45; // ~once/second at 60fps/1x
export const ENERGY_DRIFT_WARN_RATIO = 10; // energy changed by >1000% of baseline: matches the notification alarm
export const ENERGY_DRIFT_CAUTION_RATIO = 0.5; // energy changed by >50% of baseline: amber tint on the live readout, below the warn/notification level

export class AppStore {
  constructor() {
    this.presetId = DEFAULT_PRESET;
    /** Reference frame origin: 'com' or a body index. */
    this.origin = 'com';
    this.sim = new Simulation(PRESETS[this.presetId].build(), { dt: 0.008 });
    // Sim speed, as a multiplier on integrator steps per frame (see setSpeed).
    this.speedFactor = SPEED_FACTORS[DEFAULT_SPEED_INDEX];
    // Fractional sub-step carry: lets factors below 1 (slow motion) advance
    // the sim by one dt every Nth frame instead of never advancing at all.
    this._stepAccumulator = 0;

    this._originListeners = new Set();
    this._presetListeners = new Set();

    // --- Notifications (generic; the energy-drift monitor is just one producer) ---
    this.notifications = [];
    this._notificationListeners = new Set();
    this._nextNotificationId = 1;

    // --- Energy-conservation drift monitor + live readout ---
    this._ticksSinceEnergyCheck = 0;
    this._driftWarned = false; // one warning per baseline epoch, not per check
    this._energyListeners = new Set();
    this.currentEnergy = null;
    this.energyRatio = 1; // current/baseline; 1 == perfectly conserved
    this._captureEnergyBaseline();
  }

  /** (Re)capture the energy baseline against which drift is measured. */
  _captureEnergyBaseline() {
    // Guard: totalEnergy() should exist, but don't let its absence break
    // the store if core hasn't landed it yet / bodies are empty.
    this.energyBaseline =
      typeof this.sim.totalEnergy === 'function' ? this.sim.totalEnergy() : null;
    this._driftWarned = false;
    this._ticksSinceEnergyCheck = 0;
    // Snap the live readout back to the new baseline immediately, rather
    // than waiting for the next throttled tick.
    this.currentEnergy = this.energyBaseline;
    this.energyRatio = 1;
    this._emitEnergy();
  }

  // --- Live energy readout API ---
  // A cheap, always-on gauge over the same quantity the drift monitor
  // watches (same totalEnergy(), same baseline) — the widget is the gauge,
  // the notification is the alarm when it crosses ENERGY_DRIFT_WARN_RATIO.

  onEnergyChange(fn) {
    this._energyListeners.add(fn);
    return () => this._energyListeners.delete(fn);
  }

  _emitEnergy() {
    const payload = { current: this.currentEnergy, baseline: this.energyBaseline, ratio: this.energyRatio };
    for (const fn of this._energyListeners) fn(payload);
  }

  /** Throttled: recompute current energy, refresh the ratio, and check for a blow-up. */
  _updateEnergyReadout() {
    if (typeof this.sim.totalEnergy !== 'function') return;
    const current = this.sim.totalEnergy();
    this.currentEnergy = current;

    const baseline = this.energyBaseline;
    this.energyRatio = baseline != null && Math.abs(baseline) > 1e-12 ? current / baseline : 1;
    this._emitEnergy();

    this._checkEnergyDrift(current);
  }

  /** Has total energy drifted far enough from baseline to be alarming? */
  _checkEnergyDrift(current) {
    if (this.energyBaseline == null || this._driftWarned) return;

    const denom = Math.abs(this.energyBaseline);
    if (denom < 1e-12) return; // baseline ~0: relative drift is undefined/meaningless

    const relativeDrift = Math.abs(current - this.energyBaseline) / denom;
    if (relativeDrift > ENERGY_DRIFT_WARN_RATIO) {
      this._driftWarned = true;
      this.addNotification({
        level: 'warning',
        message: `Energy drifted ${relativeDrift.toFixed(1)}x from baseline — the simulation may have become numerically unstable (e.g. a close encounter). Try Reset.`,
      });
    }
  }

  // --- Notifications API ---

  /** Fired whenever the notification list changes. */
  onNotificationsChange(fn) {
    this._notificationListeners.add(fn);
    return () => this._notificationListeners.delete(fn);
  }

  _emitNotifications() {
    for (const fn of this._notificationListeners) fn(this.notifications);
  }

  /** Add a notification ({level: 'info'|'warning'|'error', message}). Returns its id. */
  addNotification({ level = 'info', message }) {
    const id = this._nextNotificationId++;
    this.notifications = [{ id, level, message }, ...this.notifications];
    this._emitNotifications();
    return id;
  }

  dismissNotification(id) {
    this.notifications = this.notifications.filter((n) => n.id !== id);
    this._emitNotifications();
  }

  // --- Frame subscription (delegates to the sim) ---
  onFrame(fn) {
    return this.sim.onFrame(fn);
  }

  /** Fired when the reference-frame origin changes. */
  onOriginChange(fn) {
    this._originListeners.add(fn);
    return () => this._originListeners.delete(fn);
  }

  /** Fired when the preset (and thus the body set) changes. */
  onPresetChange(fn) {
    this._presetListeners.add(fn);
    return () => this._presetListeners.delete(fn);
  }

  setOrigin(origin) {
    this.origin = origin;
    for (const fn of this._originListeners) fn(origin);
    this.sim.emit(); // re-publish current frame under the new origin
  }

  setPreset(presetId) {
    if (!PRESETS[presetId]) return;
    this.presetId = presetId;
    // Reset origin if it points past the new body count.
    this.sim.setBodies(PRESETS[presetId].build());
    if (typeof this.origin === 'number' && this.origin >= this.sim.bodies.length) {
      this.origin = 'com';
    }
    this._captureEnergyBaseline();
    for (const fn of this._presetListeners) fn(presetId);
  }

  reset() {
    this.sim.setBodies(PRESETS[this.presetId].build());
    this._captureEnergyBaseline();
  }

  togglePlay() {
    this.sim.running = !this.sim.running;
    return this.sim.running;
  }

  /** Set the sim speed factor (steps per frame, on average), clamped to a sane range. */
  setSpeed(factor) {
    this.speedFactor = Math.min(MAX_SPEED_FACTOR, Math.max(MIN_SPEED_FACTOR, factor));
    return this.speedFactor;
  }

  /**
   * Drive the integrator by one animation frame.
   *
   * Sub-1x factors can't take a fractional RK4 step, so we carry the
   * remainder across frames: add speedFactor to the accumulator, run
   * Math.floor(accumulator) whole steps now, and keep the fractional part
   * for next frame. E.g. factor=0.01 advances one dt roughly every 100
   * frames — a smooth crawl — while factor=8 runs 8 steps every frame.
   */
  tick() {
    this._stepAccumulator += this.speedFactor;
    const steps = Math.floor(this._stepAccumulator);
    this._stepAccumulator -= steps;
    if (steps > 0) this.sim.advance(steps);

    // Throttled: don't recompute totalEnergy() every frame.
    this._ticksSinceEnergyCheck++;
    if (this._ticksSinceEnergyCheck >= ENERGY_CHECK_INTERVAL_TICKS) {
      this._ticksSinceEnergyCheck = 0;
      this._updateEnergyReadout();
    }
  }
}

export const store = new AppStore();
