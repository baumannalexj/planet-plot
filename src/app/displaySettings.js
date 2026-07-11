// Shared display/rendering options, independent of the physics store.
//
// This is a tiny observable settings object that the 3D viewport and the 3D
// plot renderer both read from, so a single control panel can toggle rendering
// behavior across every 3D view at once. Kept separate from AppStore (which
// owns simulation state) so display toggles never touch physics.

export const NLIPS_DESCRIPTION =
  'Non-Linear Inverse Perspective Scaling: scale bodies/markers by distance ' +
  'from the camera so distant objects stay visible.';

class DisplaySettings {
  constructor() {
    /** NLIPS depth scaling on/off (applies to 3D marker/body sizing). */
    this.nlips = false;
    /** Scale body/sphere size by mass (log-compressed) vs. uniform size. */
    this.massSize = true;
    /** Show axis name labels in the 3D plots. */
    this.axisNames = true;

    /** @type {Set<(s: DisplaySettings) => void>} */
    this._listeners = new Set();
  }

  /** Subscribe to any settings change. Returns an unsubscribe fn. */
  onChange(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  _emit() {
    for (const fn of this._listeners) fn(this);
  }

  /** Set one option by key and notify listeners. */
  set(key, value) {
    if (!(key in this) || key.startsWith('_')) return;
    this[key] = value;
    this._emit();
  }

  /** Flip a boolean option and notify listeners. */
  toggle(key) {
    this.set(key, !this[key]);
    return this[key];
  }
}

export const displaySettings = new DisplaySettings();
