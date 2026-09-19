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
    /** Compute + render the 5 Lagrange points (L1-L5) for the two most massive bodies. */
    this.showLagrangePoints = false;
    /** Compute + render a gravitational-force vector-arrow field in the z=0 plane. */
    this.showForceField = false;
    /** Alternative to showForceField: render the same field as camera-facing 2D arrow billboards. */
    this.showBillboardArrows = false;
    /** Which canvas-drawn arrow shape the billboard arrows use — see arrowStyles.js. */
    this.arrowStyle = 'skinny';
    /** Force-field magnitude-to-size gamma exponent (displayedMag = normalizedMag ** (1/scale)). 1 = identity; >1 boosts weak/far-field arrows; <1 compresses them further. Must stay > 0. */
    this.forceFieldScale = 1;
    /** Compute + render a gravitational-potential scalar-field displacement mesh. */
    this.showPotentialField = false;
    /** Potential-field z-plane offset for sampling. */
    this.potentialFieldZ = 0;
    /** Potential-field displacement magnitude multiplier. */
    this.potentialFieldScale = 1;
    /** Compute + render equipotential contour lines over the potential field. */
    this.showEquipotentialLines = false;
    /** Number of equipotential contour lines to draw. */
    this.equipotentialLineCount = 5;
    /** Compute + render gravitational field-line streamlines from seeds around each body. */
    this.showFieldLines = false;
    /** Field-lines rendered length/arrow-spacing multiplier — mirrors forceFieldScale. */
    this.fieldLinesScale = 1;

    // --- Shared adaptive spherical-shell discretization (Task 25) ---
    // Replaces the old per-overlay forceFieldRadius/forceFieldCount/
    // potentialFieldResolution/fieldLinesRadius/fieldLinesCount fields — all
    // 4 field/streamline calculators now sample via the same shell grid
    // (see DiscretizationGrid.computeShellGrid).
    /** "Sphere of draw" — outer radius of the sampled shell grid (AU). */
    this.drawRadius = 20;
    /** Number of concentric radial shells. */
    this.radiusIterations = 12;
    /** Baseline theta (azimuthal) samples per shell, before skew falloff. */
    this.thetaIterations = 24;
    /** Baseline phi (polar) samples per shell for non-planar (3D) grids, before skew falloff. */
    this.phiIterations = 12;
    /** Density skew: 0 = uniform per-shell sample count; >0 concentrates samples toward the center (1/r^skew falloff on outer shells). */
    this.magnitudeModSkewAll = 1.5;
    /** Hard render-count ceiling — sampled points beyond this are stride-decimated before instancing/rendering. */
    this.iconCount = 4096;
    /** Force-field rendered magnitude/opacity multiplier — orthogonal to sampling density. */
    this.magnitudeModForceField = 1.0;
    /** Potential-field rendered magnitude/opacity multiplier — orthogonal to sampling density. */
    this.magnitudeModPotential = 1.0;
    /** Equipotential-lines rendered magnitude/opacity multiplier — orthogonal to sampling density. */
    this.magnitudeModEquipotentialLines = 1.0;

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
