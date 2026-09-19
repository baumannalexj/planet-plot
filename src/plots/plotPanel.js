// Right plotting panel (Agent B).
//
// Contract:
//   mountPlotPanel(el, store) — let the user add plots. Each plot picks a
//   coordinate system (see src/core/coordinates.js) and what goes on each axis
//   (X, Y, optional Z). Data is expressed relative to store.origin. Default
//   plot: spherical speed |v| (X) vs kinetic energy (Y) vs φ azimuth (Z).
//
// Rendering: every plot is a single Plot3D (src/plots/plot3d.js, Three.js).
// There's no separate 2D engine — when Z is off, all points get z=0 and the
// camera defaults to a straight-on view, so it *reads* like a flat 2D line
// chart while still being the same renderer (OrbitControls lets the user tilt
// it if they want). Turning Z on just starts giving points a real Z value and
// the same scene now has depth. One renderer, no swap/teardown on toggle.

import { COORD_SYSTEMS, DEFAULT_COORD_SYSTEM } from '../core/coordinates.js';
import { getMetricOptions, computeMetric, isPeriodicMetric, unitForMetric } from './metrics.js';
import { Plot3D } from './plot3d.js';
import { ACTIVE_CORRECTION } from '@adapters/plotCorrections/index.js';
import './plotPanel.css';

const HISTORY_LIMIT = 400;
const OFF = ''; // Z-select value representing "no Z metric".
// A segment connecting two consecutive normalized points that spans more
// than this fraction of the plot cube's [-1,1] extent (diameter 2 — 0.5 is a
// quarter of that) in a SINGLE frame is treated as a discontinuity rather
// than motion the polyline should draw. This catches non-angle jumps that
// the periodic-axis branch-cut fallback below can't see: e.g. θ (spherical
// polar, [0,π], no branch cut) plotted against speed still visibly "jumped"
// per a user report — turned out to be a real body crossing near the pole/
// close encounter while the sim was running at a high speed factor (several
// RK4 sub-steps folded into one plotted frame, per AppStore.setSpeed), so
// the two plotted points are genuinely far apart and a straight line between
// them is misleading, not a rendering bug. Investigated and ruled out: mixed
// ratchet normalization (every point is re-normalized from raw values under
// the CURRENT xRange/yRange/zRange every frame — see the points.map below —
// so there's no stale-vs-fresh mix), and a ring-buffer wrap connecting
// buf[end] to buf[0] (the history arrays are plain arrays with
// Array.shift(), and plot3d.js's segment loop only ever pairs index i-1 with
// i for i in [1, n) — index 0 is never paired with the newest point).
// Empirically, ordinary playback (speed factor 1x-8x) across every shipped
// preset/metric combination never produced a normalized step above ~0.31;
// this threshold leaves headroom above that while still catching the
// ~0.5-0.8 steps seen at 16x / near close encounters.
const STEP_BREAK_THRESHOLD = 0.5;

let nextPlotId = 1;

/** Compact display string for a live per-body axis value. '—' for non-finite (NaN/Infinity). */
function formatReadoutValue(v) {
  if (!Number.isFinite(v)) return '—';
  return v.toFixed(2);
}

/**
 * One plot card: coord-system + X/Y/Z metric pickers, a rolling per-body
 * history buffer, and a Plot3D view normalized into a stable [-1,1] cube.
 */
class PlotInstance {
  constructor(store, onRemove) {
    this.id = nextPlotId++;
    this.store = store;
    this.onRemove = onRemove;
    this.coordSystemId = DEFAULT_COORD_SYSTEM;
    this.xMetric = 'time';
    this.yMetric = 'speed';
    this.zMetric = null; // off by default
    /** @type {Map<string, {x: number[], y: number[], z: number[]}>} keyed by body name */
    this.history = new Map();
    // Ratcheted axis bounds: widest [min, max] ever observed for a given
    // metric selection, across all bodies and all history (not just what's
    // still in the rolling buffer). Grow-only, so a periodic peak doesn't
    // un-ratchet once it scrolls out of the buffer — that's what keeps
    // stable/periodic orbits from jittering every frame. Reset whenever the
    // underlying data range can legitimately change (resetHistory()).
    //
    // Exception: an axis whose metric is literally "time" uses a live
    // window (current buffer's min/max, recomputed every frame) instead of
    // the ratchet, so it keeps scrolling forward rather than compressing
    // toward one edge as elapsed sim time grows without bound.
    this.xRange = { min: Infinity, max: -Infinity };
    this.yRange = { min: Infinity, max: -Infinity };
    this.zRange = { min: Infinity, max: -Infinity };

    // Which discontinuity/periodic-axis handling strategy this plot uses —
    // see adapters/plotCorrections/index.js. Swappable per-instance if ever needed; defaults
    // to whichever is currently active.
    this.correction = ACTIVE_CORRECTION;

    this._buildDom();
    this.plot3d = new Plot3D(this.viewportEl);
    this.resetHistory();
  }

  _buildDom() {
    this.card = document.createElement('div');
    this.card.className = 'plot-card';

    const controls = document.createElement('div');
    controls.className = 'plot-card__controls';

    const coordRow = document.createElement('div');
    coordRow.className = 'plot-card__coord-row';

    this.coordSelect = document.createElement('select');
    this.coordSelect.name = `plot-${this.id}-coord`;
    for (const sys of Object.values(COORD_SYSTEMS)) {
      const opt = document.createElement('option');
      opt.value = sys.id;
      opt.textContent = sys.label;
      this.coordSelect.appendChild(opt);
    }
    this.coordSelect.value = this.coordSystemId;
    this.coordSelect.addEventListener('change', () => {
      this.coordSystemId = this.coordSelect.value;
      this._rebuildMetricOptions();
      this.resetHistory();
    });

    const removeBtn = document.createElement('button');
    removeBtn.className = 'plot-remove-btn';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => this.onRemove(this));

    coordRow.append(this.coordSelect, removeBtn);

    // X/Y/Z as a label|select grid so the three rows share one vertical
    // edge and equal-width selects, instead of wrapping as a single flex
    // row (which staggered Z onto its own line at narrower widths).
    const axisGrid = document.createElement('div');
    axisGrid.className = 'plot-card__axis-grid';

    const xLabel = document.createElement('span');
    xLabel.className = 'plot-card__axis-label';
    xLabel.textContent = 'X:';
    this.xSelect = document.createElement('select');
    this.xSelect.name = `plot-${this.id}-x`;
    this.xSelect.addEventListener('change', () => {
      this.xMetric = this.xSelect.value;
      this.resetHistory();
    });
    this.xReadout = this._buildReadout();

    const yLabel = document.createElement('span');
    yLabel.className = 'plot-card__axis-label';
    yLabel.textContent = 'Y:';
    this.ySelect = document.createElement('select');
    this.ySelect.name = `plot-${this.id}-y`;
    this.ySelect.addEventListener('change', () => {
      this.yMetric = this.ySelect.value;
      this.resetHistory();
    });
    this.yReadout = this._buildReadout();

    const zLabel = document.createElement('span');
    zLabel.className = 'plot-card__axis-label';
    zLabel.textContent = 'Z:';
    this.zSelect = document.createElement('select');
    this.zSelect.name = `plot-${this.id}-z`;
    this.zSelect.addEventListener('change', () => {
      this.zMetric = this.zSelect.value === OFF ? null : this.zSelect.value;
      this.resetHistory();
    });
    this.zReadout = this._buildReadout();

    axisGrid.append(
      xLabel, this.xSelect, this.xReadout.el,
      yLabel, this.ySelect, this.yReadout.el,
      zLabel, this.zSelect, this.zReadout.el
    );

    controls.append(coordRow, axisGrid);

    const viewportWrap = document.createElement('div');
    viewportWrap.className = 'plot-3d-wrap';
    this.viewportEl = viewportWrap;

    this.card.append(controls, viewportWrap);
    this._rebuildMetricOptions();
  }

  /**
   * Build one axis's live-value readout: a row of per-body color-coded dots
   * (one per body, in store.sim.bodies order) followed by a single unit
   * suffix for the whole axis. Returns handles kept on the instance so
   * pushFrame()/resetHistory() can update it in place each frame instead of
   * rebuilding innerHTML (perf — same reasoning as the object panel).
   */
  _buildReadout() {
    const el = document.createElement('span');
    el.className = 'plot-card__readout';
    const dotsWrap = document.createElement('span');
    dotsWrap.className = 'plot-card__readout-dots';
    const unitEl = document.createElement('span');
    unitEl.className = 'plot-card__readout-unit';
    el.append(dotsWrap, unitEl);
    return { el, dotsWrap, unitEl, dots: [] };
  }

  /** Rebuild a readout's per-body dot+value slots to match the current body set/colors. */
  _rebuildReadoutSlots(readout, bodies) {
    readout.dotsWrap.innerHTML = '';
    readout.dots = bodies.map((b) => {
      const dot = document.createElement('span');
      dot.className = 'plot-card__readout-dot';
      dot.style.color = b.color;
      const valueText = document.createTextNode('—');
      // dot.append('●', valueText);
      dot.append(valueText);
      readout.dotsWrap.appendChild(dot);
      return valueText;
    });
  }

  /** Update one axis readout's unit suffix (only changes on metric/coord-system change). */
  _setReadoutUnit(readout, metricId) {
    const unit = metricId ? unitForMetric(metricId, this.coordSystemId) : '';
    readout.unitEl.textContent = unit ? ` ${unit}` : '';
  }

  /** Rebuild all three readouts' body slots + unit suffixes (bodies/colors or metrics changed). */
  _rebuildReadouts(bodies) {
    this._rebuildReadoutSlots(this.xReadout, bodies);
    this._rebuildReadoutSlots(this.yReadout, bodies);
    this._rebuildReadoutSlots(this.zReadout, this.zMetric ? bodies : []);
    this._setReadoutUnit(this.xReadout, this.xMetric);
    this._setReadoutUnit(this.yReadout, this.yMetric);
    this._setReadoutUnit(this.zReadout, this.zMetric);
  }

  /** Repopulate the X/Y/Z metric dropdowns from the current coordinate system. */
  _rebuildMetricOptions() {
    const options = getMetricOptions(this.coordSystemId);

    for (const select of [this.xSelect, this.ySelect]) {
      const current = select === this.xSelect ? this.xMetric : this.yMetric;
      select.innerHTML = '';
      for (const opt of options) {
        const el = document.createElement('option');
        el.value = opt.id;
        el.textContent = opt.label;
        select.appendChild(el);
      }
      // Keep the previous selection if it still exists in the new system,
      // otherwise fall back to the first option.
      select.value = options.some((o) => o.id === current) ? current : options[0].id;
    }
    this.xMetric = this.xSelect.value;
    this.yMetric = this.ySelect.value;

    const currentZ = this.zMetric ?? OFF;
    this.zSelect.innerHTML = '';
    const offOpt = document.createElement('option');
    offOpt.value = OFF;
    offOpt.textContent = '— off —';
    this.zSelect.appendChild(offOpt);
    for (const opt of options) {
      const el = document.createElement('option');
      el.value = opt.id;
      el.textContent = opt.label;
      this.zSelect.appendChild(el);
    }
    // Fall back to off (not "first option") if the previous Z metric
    // doesn't exist in the new coordinate system — Z is opt-in, so losing
    // the selection should feel like turning it off, not silently picking
    // an unrelated component.
    this.zSelect.value = currentZ === OFF || options.some((o) => o.id === currentZ) ? currentZ : OFF;
    this.zMetric = this.zSelect.value === OFF ? null : this.zSelect.value;
  }

  _metricLabel(metricId) {
    if (!metricId) return null;
    const opt = getMetricOptions(this.coordSystemId).find((o) => o.id === metricId);
    return opt ? opt.label : metricId;
  }

  /** Grow a ratcheted [min, max] range to cover `value`, never shrinking it. */
  _growRange(range, value) {
    if (!Number.isFinite(value)) return;
    if (value < range.min) range.min = value;
    if (value > range.max) range.max = value;
  }

  /**
   * Padded [min, max] for a range: a small % of the observed span on each
   * side, with a floor so a near-flat line doesn't collapse onto a
   * zero-width axis.
   */
  _paddedBounds(range) {
    if (!Number.isFinite(range.min) || !Number.isFinite(range.max)) return null;
    const span = range.max - range.min;
    // Normally pad by 5% of the observed span. For a near-flat line (span
    // ~0) fall back to 5% of the value's own magnitude so the floor scales
    // with the metric (radians vs. AU vs. energy) instead of a fixed
    // constant that would swamp small-scale metrics like angles.
    const magnitude = Math.max(Math.abs(range.min), Math.abs(range.max), 1);
    const pad = span > 1e-9 ? span * 0.05 : magnitude * 0.05;
    return { min: range.min - pad, max: range.max + pad };
  }

  /** Live min/max across every body's buffered values for one component ('x'|'y'|'z'). */
  _windowRange(component) {
    const range = { min: Infinity, max: -Infinity };
    for (const buf of this.history.values()) {
      for (const v of buf[component]) this._growRange(range, v);
    }
    return range;
  }

  /**
   * Bounds to normalize an axis by: a live scrolling window for "time"
   * (so it keeps moving forward instead of compressing as elapsed time
   * grows), otherwise the grow-only ratchet (so periodic data doesn't
   * jitter as points scroll out of the buffer).
   */
  _boundsFor(metricId, ratchetRange, component) {
    if (metricId === 'time') return this._paddedBounds(this._windowRange(component));
    return this._paddedBounds(ratchetRange);
  }

  /** Map a value into [-1, 1] given bounds; degrades gracefully if bounds are null/degenerate. */
  _normalize(value, bounds) {
    if (!bounds || !Number.isFinite(value)) return 0;
    const span = bounds.max - bounds.min;
    if (span <= 1e-12) return 0;
    const n = ((value - bounds.min) / span) * 2 - 1;
    // Bounds are padded outward from the ratchet/window range (see
    // _paddedBounds), so every in-range value should already land strictly
    // inside (-1, 1) — this clamp is a hard guarantee on top of that so a
    // trace can never be drawn poking through the bounding box, even from an
    // edge case (e.g. a value observed between this frame's _growRange call
    // and the bounds being read, or float rounding right at the ratchet
    // extreme).
    return Math.min(1, Math.max(-1, n));
  }

  /** The metric id currently assigned to one axis slot ('x'|'y'|'z'). */
  _metricForSlot(slot) {
    return slot === 'z' ? this.zMetric : this[`${slot}Metric`];
  }

  /**
   * Decide whether this plot needs the circular embedding, and if so, which
   * slot plays which role. A periodic metric (phi, nu — see isPeriodicMetric)
   * is an ANGLE: 2π ≡ 0, so +π and -π are the same point and plotting it as
   * an ordinary bounded linear coordinate is wrong — it either needs a break
   * at the seam (old approach) or grows unboundedly if unwrapped (rejected —
   * defeats its periodicity). Instead, when exactly one active slot is
   * periodic, that slot becomes the ANGLE around a ring/cylinder (see
   * _buildSeriesPoint) and never needs a break: cos/sin naturally close the
   * loop.
   *
   * @returns {{ringSlot: 'x'|'y'|'z', radiusSlot: ('x'|'y'|'z')|null, heightSlot: ('x'|'y'|'z')|null} | null}
   *   null when no active slot is periodic (plain cartesian cube).
   *   If MORE than one active slot is periodic, only the first (x, then y,
   *   then z priority) becomes the ring; any other periodic slot lands in
   *   radiusSlot/heightSlot and is plotted as an ordinary linear value (see
   *   _isBreak for how its branch cut is still handled) — a full torus
   *   embedding for two simultaneous angles is deliberately not built here.
   */
  _computeCircularPlan() {
    const activeSlots = ['x', 'y', ...(this.zMetric ? ['z'] : [])];
    return this.correction.computePlan(activeSlots, (s) => isPeriodicMetric(this._metricForSlot(s)));
  }

  /**
   * Precompute this frame's normalization bounds for whichever slots need
   * them (once per frame, not once per point — mirrors the old flat-cube
   * code's xBounds/yBounds/zBounds). Circular mode only needs bounds for
   * radiusSlot/heightSlot (linear roles); the ring slot's raw angle is used
   * directly, no bounds required (see _buildSeriesPoint).
   */
  _frameBounds() {
    const ring = this._circularPlan;
    if (!ring) {
      return {
        x: this._boundsFor(this.xMetric, this.xRange, 'x'),
        y: this._boundsFor(this.yMetric, this.yRange, 'y'),
        z: this.zMetric ? this._boundsFor(this.zMetric, this.zRange, 'z') : null,
      };
    }
    const bounds = {};
    for (const slot of [ring.radiusSlot, ring.heightSlot]) {
      if (slot) bounds[slot] = this._boundsFor(this._metricForSlot(slot), this[`${slot}Range`], slot);
    }
    return bounds;
  }

  /**
   * One history-buffer index -> one normalized 3D scene point. Plain
   * cartesian case: each slot independently normalized into [-1,1] as
   * before. Circular case (this._circularPlan set): the ring slot's RAW
   * angle (already bounded to (-π, π]) maps directly to a position around a
   * circle via cos/sin — no ratcheting needed, since an angle is already
   * bounded and 2π-periodic, so it can never "poke out" of the ring the way
   * an unbounded linear value could poke out of the cube. The remaining
   * slot(s) become the ring's radius (in-plane modulation, mapped into
   * [CIRCULAR_R0 - CIRCULAR_RK, CIRCULAR_R0 + CIRCULAR_RK]) and height
   * (out-of-plane, reusing the normal [-1,1] linear normalization).
   */
  _buildSeriesPoint(buf, idx, bounds) {
    return this.correction.buildPoint({
      buf,
      idx,
      bounds,
      plan: this._circularPlan,
      normalize: (value, b) => this._normalize(value, b),
    });
  }

  /**
   * Whether to break the polyline between points[idx-1] and points[idx].
   * Always applies the generic large-single-frame-step check (genuine
   * under-sampling at high sim speed — see STEP_BREAK_THRESHOLD); in
   * circular mode, ALSO checks for a branch-cut flip in whichever slot(s)
   * ended up filling the radius/height role despite being periodic-valued
   * (the 2+-periodic-axes fallback noted in _computeCircularPlan) — that
   * value is plotted as an ordinary linear coordinate, not embedded on a
   * ring, so it still needs a seam break to avoid a spurious chord. The
   * ring slot itself never needs this: cos/sin of a raw (-π, π] angle is
   * already continuous across the seam by construction.
   */
  _isBreak(buf, idx, point, prevPoint) {
    return this.correction.isBreak({
      buf,
      idx,
      point,
      prevPoint,
      plan: this._circularPlan,
      isPeriodicSlot: (s) => isPeriodicMetric(this._metricForSlot(s)),
      threshold: STEP_BREAK_THRESHOLD,
    });
  }

  /** Clear buffered history + ratchets and rebuild series/labels (metric/origin/preset changed). */
  resetHistory() {
    this.history.clear();
    const bodies = this.store.sim.bodies;
    for (const b of bodies) this.history.set(b.name, { x: [], y: [], z: [] });

    this.xRange = { min: Infinity, max: -Infinity };
    this.yRange = { min: Infinity, max: -Infinity };
    this.zRange = { min: Infinity, max: -Infinity };

    // Recompute once here (rather than every pushFrame) since it only
    // depends on which metrics are selected, not on the data itself — see
    // _computeCircularPlan for what "circular" means and when it applies.
    this._circularPlan = this._computeCircularPlan();
    this.plot3d.setGeometryMode(this._circularPlan);

    this.plot3d.setAxisLabels(
      this._axisLabelWithUnit(this.xMetric),
      this._axisLabelWithUnit(this.yMetric),
      this._axisLabelWithUnit(this.zMetric)
    );
    this.plot3d.setSeries(bodies.map((b) => ({ id: b.name, color: b.color, points: [] })));
    // A fresh selection means the old camera framing no longer matches the
    // data (e.g. Z just got turned off) — snap back to the default
    // straight-on view so "off" plots read as flat 2D again.
    this.plot3d.resetCamera();
    // Body set/colors and/or the chosen metrics may have changed — rebuild
    // the live-value readout slots and unit suffixes to match.
    this._rebuildReadouts(bodies);
  }

  /** Axis label with a "(unit)" suffix, e.g. "φ (rad)" — no parens when the metric is unitless/off. */
  _axisLabelWithUnit(metricId) {
    const label = this._metricLabel(metricId);
    if (!label) return label;
    const unit = unitForMetric(metricId, this.coordSystemId);
    return unit ? `${label} (${unit})` : label;
  }

  /** Push one new point per body from the latest snapshot and re-render. */
  pushFrame(snapshot, origin) {
    const bodies = snapshot.relativeBodies(origin);

    bodies.forEach((body) => {
      let buf = this.history.get(body.name);
      if (!buf) {
        buf = { x: [], y: [], z: [] };
        this.history.set(body.name, buf);
      }
      // Raw values, straight from computeMetric — no unwrapping. A periodic
      // metric's raw sample is always in (-π, π] (atan2's range) and stays
      // that way in the buffer; when it's the ring slot, _buildSeriesPoint
      // maps it to a position around a circle (cos/sin), so the bounded raw
      // angle is exactly what circular embedding wants. Ratchets below skip
      // periodic slots entirely for the same reason: a bounded angle needs
      // no ratchet/window normalization, unlike a linear metric.
      const x = computeMetric(this.xMetric, body, snapshot, this.coordSystemId);
      const y = computeMetric(this.yMetric, body, snapshot, this.coordSystemId);
      const z = this.zMetric ? computeMetric(this.zMetric, body, snapshot, this.coordSystemId) : 0;
      buf.x.push(x);
      buf.y.push(y);
      buf.z.push(z);
      if (buf.x.length > HISTORY_LIMIT) {
        buf.x.shift();
        buf.y.shift();
        buf.z.shift();
      }

      // Grow the ratchet for every active metric except "time" (which uses a
      // live scrolling window instead — see _boundsFor). Periodic metrics
      // ARE grown too: circularEmbeddingCorrection's ring slot never reads
      // this range (it uses the raw angle directly via cos/sin), so growing
      // it there is just unused, harmless work — but noopPlotCorrection (and
      // any slot NOT chosen as the ring, e.g. a periodic radius/height in
      // the 2+-periodic-axes fallback) DOES call normalize() on it, which
      // needs real bounds. Skipping growth here used to leave those bounds
      // permanently {min:Infinity, max:-Infinity}, normalizing to a flat 0
      // for the whole run — a real bug, not "raw/uncorrected" behavior.
      if (this.xMetric !== 'time') this._growRange(this.xRange, x);
      if (this.yMetric !== 'time') this._growRange(this.yRange, y);
      if (this.zMetric && this.zMetric !== 'time') this._growRange(this.zRange, z);
    });

    const bounds = this._frameBounds();
    const seriesList = bodies.map((body) => {
      const buf = this.history.get(body.name);
      const points = buf.x.map((_xv, idx) => this._buildSeriesPoint(buf, idx, bounds));
      // See _isBreak: always checks the generic large-single-frame-step
      // case; in circular mode also re-checks any periodic slot that
      // DIDN'T become the ring (the 2+-periodic-axes fallback) since that
      // one is still plotted as an ordinary linear value and still has a
      // ±π seam. The ring slot itself never breaks — see _buildSeriesPoint.
      const breaks = points.map((p, idx) => (idx === 0 ? false : this._isBreak(buf, idx, p, points[idx - 1])));
      return { id: body.name, color: body.color, points, breaks };
    });
    this.plot3d.setSeries(seriesList);

    // Live per-axis value readouts show the raw current value — for a
    // periodic axis that's the bounded (-π, π] angle, which reads
    // intuitively as "what is φ right now" (and is also just what's
    // buffered, now that there's no separate unwrapped value). Update
    // existing text nodes in place (not innerHTML) so this doesn't thrash
    // layout every frame.
    bodies.forEach((body, idx) => {
      const buf = this.history.get(body.name);
      const last = buf.x.length - 1;
      if (this.xReadout.dots[idx]) this.xReadout.dots[idx].data = formatReadoutValue(buf.x[last]);
      if (this.yReadout.dots[idx]) this.yReadout.dots[idx].data = formatReadoutValue(buf.y[last]);
      if (this.zMetric && this.zReadout.dots[idx]) this.zReadout.dots[idx].data = formatReadoutValue(buf.z[last]);
    });
  }

  destroy() {
    this.plot3d.dispose();
    this.card.remove();
  }
}

/**
 * Mount the plotting panel: an "Add plot" button and a stack of PlotInstance
 * cards, all wired to a single store subscription set.
 * @param {HTMLElement} el
 * @param {import('../app/store.js').AppStore} store
 */
export function mountPlotPanel(el, store) {
  el.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'plot-panel__header';
  const title = document.createElement('h2');
  title.textContent = 'Plots';
  const addBtn = document.createElement('button');
  addBtn.className = 'plot-add-btn';
  addBtn.textContent = '+ Add plot';
  header.append(title, addBtn);

  const list = document.createElement('div');
  list.className = 'plot-list';

  el.append(header, list);

  /** @type {PlotInstance[]} */
  const plots = [];

  function addPlot(configure) {
    const plot = new PlotInstance(store, removePlot);
    if (configure) configure(plot);
    plots.push(plot);
    list.appendChild(plot.card);
    return plot;
  }

  function removePlot(plot) {
    const idx = plots.indexOf(plot);
    if (idx === -1) return;
    plots.splice(idx, 1);
    plot.destroy();
  }

  addBtn.addEventListener('click', () => addPlot());

  // Default first plot: spherical, X = speed |v|, Y = kinetic energy,
  // Z = phi (azimuth) — Z is ON, so the default plot is 3D immediately. Set
  // the coord system before the metric ids so _rebuildMetricOptions()
  // populates the selects from spherical's axis list (r/theta/phi) — 'phi'
  // isn't a valid option under the initial cartesian default, so it must be
  // set after.
  addPlot((plot) => {
    plot.coordSystemId = 'spherical';
    plot.coordSelect.value = 'spherical';
    plot.xMetric = 'speed';
    plot.yMetric = 'ke';
    plot.zMetric = 'phi';
    plot._rebuildMetricOptions();
    plot.resetHistory();
  });

  store.onFrame((snapshot) => {
    for (const plot of plots) plot.pushFrame(snapshot, store.origin);
  });

  // Values are expressed relative to store.origin, so a frame-of-reference
  // change invalidates buffered history — same story for a preset swap,
  // which also changes body identities/colors and rebuilds datasets.
  store.onOriginChange(() => {
    for (const plot of plots) plot.resetHistory();
  });
  store.onPresetChange(() => {
    for (const plot of plots) plot.resetHistory();
  });
}
