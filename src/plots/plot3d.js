// Self-contained 3D metric-space renderer for a single plot card.
//
// Not the viewport: this draws whatever metrics the user picked for X/Y/Z
// (e.g. time, speed, r, theta — see metrics.js), not physical body positions.
// Deliberately does not import from src/viewport/ so the two panels stay
// decoupled; it uses the `three` library directly, same as the viewport does.
//
// Contract: caller (PlotInstance in plotPanel.js) is responsible for
// normalizing metric values into the [-1, 1] cube this renderer draws (via
// its own running-min/max ratchet) and passing already-normalized points.
// Plot3D itself only knows about drawing: axes, a bounding box, per-body
// polylines + a latest-point marker, and camera/controls.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { displaySettings } from '../app/displaySettings.js';

// Muted/dark so axis geometry recedes behind the body-colored data lines.
const AXIS_COLOR = 0x232a38;
const BOX_COLOR = 0x232a38;
const LABEL_COLOR = '#e2e8f0';
const HALF_EXTENT = 1;

// Base (NLIPS-off) radius for a series' latest-point marker — matches the
// SphereGeometry radius passed in setSeries().
const MARKER_BASE_RADIUS = 0.025;
// NLIPS scale-with-distance factor, matching the viewport's NLIPS_K (see
// src/viewport/viewport.js) in spirit: apparent size grows ~linearly with
// camera distance so a marker far from this plot's own camera doesn't shrink
// into invisibility under perspective. Distances here are in the plot's own
// normalized [-1,1]^3 cube (not AU), so the constant is tuned separately —
// the cube's max diagonal is ~3.5 and the default camera sits at z=3.4, so a
// marker at the far corner is ~4-5 units out; a factor of 0.6 roughly
// doubles its apparent size there without ballooning nearby markers.
const MARKER_NLIPS_K = 0.6;

/**
 * One Three.js scene + renderer + OrbitControls, sized to a container div.
 * Draws normalized [-1,1]^3 axes/box/labels plus per-body polylines.
 */
export class Plot3D {
  constructor(container) {
    this.container = container;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.resetCamera();

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.8));

    this._buildAxes();

    this._seriesGroup = new THREE.Group();
    this.scene.add(this._seriesGroup);
    /** @type {Map<string, {line: THREE.Line, geometry: THREE.BufferGeometry, marker: THREE.Mesh}>} */
    this._seriesEntries = new Map();

    this._resizeObserver = new ResizeObserver(() => this.resize());
    this._resizeObserver.observe(container);
    this.resize();

    // Shared display settings (src/app/displaySettings.js) apply to every 3D
    // view, including this plot's own scene — read live in _animate() for
    // NLIPS (per-marker, per-frame since it depends on live camera
    // distance) and react immediately to axisNames via onChange (label
    // sprite visibility doesn't need to be recomputed every frame).
    this._applyAxisNamesVisibility();
    this._unsubscribeDisplaySettings = displaySettings.onChange(() => this._applyAxisNamesVisibility());

    this._raf = null;
    this._animate = this._animate.bind(this);
    this._animate();
  }

  /** Show/hide the axis label sprites per displaySettings.axisNames. */
  _applyAxisNamesVisibility() {
    // Sprites are already independently hidden when their text is empty
    // (see _setSpriteText) — axisNames just adds a global override on top,
    // so re-running setAxisLabels() later doesn't need to know about it.
    const show = displaySettings.axisNames;
    for (const sprite of [this._xLabel, this._yLabel, this._zLabel]) {
      sprite.visible = show && !!sprite.userData.hasText;
    }
  }

  /** Straight-on front view down -Z at the XY plane — reads as a flat 2D plot when Z is unused. */
  resetCamera() {
    this.camera.position.set(0, 0, 3.4);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(0, 0, 0);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  _buildAxes() {
    const L = HALF_EXTENT;
    this._axesGroup = new THREE.Group();

    const axisMat = new THREE.LineBasicMaterial({ color: AXIS_COLOR });
    const mkLine = (a, b) => new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), axisMat);
    this._axesGroup.add(mkLine(new THREE.Vector3(-L, 0, 0), new THREE.Vector3(L, 0, 0)));
    this._axesGroup.add(mkLine(new THREE.Vector3(0, -L, 0), new THREE.Vector3(0, L, 0)));
    this._axesGroup.add(mkLine(new THREE.Vector3(0, 0, -L), new THREE.Vector3(0, 0, L)));

    const boxGeom = new THREE.BoxGeometry(2 * L, 2 * L, 2 * L);
    const boxEdges = new THREE.EdgesGeometry(boxGeom);
    const boxMat = new THREE.LineBasicMaterial({ color: BOX_COLOR, transparent: true, opacity: 0.5 });
    this._axesGroup.add(new THREE.LineSegments(boxEdges, boxMat));
    boxGeom.dispose(); // EdgesGeometry copies what it needs; the source box isn't kept.

    this.scene.add(this._axesGroup);

    this._xLabel = this._makeLabelSprite();
    this._yLabel = this._makeLabelSprite();
    this._zLabel = this._makeLabelSprite();
    this._xLabel.position.set(L * 1.18, 0, 0);
    this._yLabel.position.set(0, L * 1.18, 0);
    this._zLabel.position.set(0, 0, L * 1.18);
    this.scene.add(this._xLabel, this._yLabel, this._zLabel);
  }

  _makeLabelSprite() {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 48;
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(0.5, 0.15, 1);
    sprite.userData.canvas = canvas;
    sprite.userData.texture = texture;
    sprite.userData.hasText = false;
    return sprite;
  }

  _setSpriteText(sprite, text) {
    const { canvas, texture } = sprite.userData;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (text) {
      // Labels now carry a "(unit)" suffix (e.g. "Kinetic energy
      // (M⊙·AU²/tu²)") which can run well past what fits at a fixed font
      // size on this small canvas — shrink the font until the text fits
      // the canvas width (with a floor so it doesn't vanish), instead of
      // clipping/overflowing at a constant 24px.
      const maxWidth = canvas.width - 12;
      let fontSize = 24;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `${fontSize}px sans-serif`;
      while (fontSize > 11 && ctx.measureText(text).width > maxWidth) {
        fontSize -= 1;
        ctx.font = `${fontSize}px sans-serif`;
      }
      ctx.fillStyle = LABEL_COLOR;
      ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    }
    texture.needsUpdate = true;
    // Actual visibility is the AND of "this axis has a label at all" and the
    // global displaySettings.axisNames toggle — recorded separately so
    // _applyAxisNamesVisibility() can flip the latter without needing to
    // know the former (and vice versa, setAxisLabels() doesn't need to know
    // about the display setting).
    sprite.userData.hasText = !!text;
    sprite.visible = !!text && displaySettings.axisNames;
  }

  /**
   * @param {string} xLabel
   * @param {string} yLabel
   * @param {string|null} zLabel  null/empty when the Z axis is off.
   */
  setAxisLabels(xLabel, yLabel, zLabel) {
    this._setSpriteText(this._xLabel, xLabel);
    this._setSpriteText(this._yLabel, yLabel);
    this._setSpriteText(this._zLabel, zLabel);
  }

  /**
   * Replace all per-body series.
   * @param {{id: string, color: string, points: number[][], breaks?: boolean[]}[]} seriesList
   *   `points` are already normalized to roughly [-1, 1] per axis.
   *   `breaks[i]` (optional), if true, means "don't draw a segment between
   *   points[i-1] and points[i]" — used so a caller can omit the connecting
   *   line across a discontinuity (e.g. an angle metric wrapping past its
   *   branch cut) instead of it showing up as a spurious chord across the
   *   whole plot. Rendered as THREE.LineSegments (disjoint segments) rather
   *   than a single polyline strip so individual segments can be dropped.
   */
  setSeries(seriesList) {
    const ids = new Set(seriesList.map((s) => s.id));
    for (const [id, entry] of this._seriesEntries) {
      if (!ids.has(id)) {
        this._disposeEntry(entry);
        this._seriesEntries.delete(id);
      }
    }

    for (const s of seriesList) {
      let entry = this._seriesEntries.get(s.id);
      if (!entry) {
        const geometry = new THREE.BufferGeometry();
        const line = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: s.color }));
        const marker = new THREE.Mesh(
          new THREE.SphereGeometry(MARKER_BASE_RADIUS, 10, 8),
          new THREE.MeshBasicMaterial({ color: s.color })
        );
        this._seriesGroup.add(line, marker);
        entry = { line, geometry, marker };
        this._seriesEntries.set(s.id, entry);
      }

      const n = s.points.length;
      const breaks = s.breaks;
      // Two vertices per drawn segment (i-1 -> i); skip any segment flagged
      // as a break. Buffer sized for the worst case (no breaks at all) and
      // trimmed via setDrawRange to however many vertices actually got
      // written.
      const flat = new Float32Array(Math.max(0, n - 1) * 6);
      let vertCount = 0;
      for (let i = 1; i < n; i++) {
        if (breaks && breaks[i]) continue;
        const a = s.points[i - 1];
        const b = s.points[i];
        const o = vertCount * 3;
        flat[o] = a[0]; flat[o + 1] = a[1]; flat[o + 2] = a[2];
        flat[o + 3] = b[0]; flat[o + 4] = b[1]; flat[o + 5] = b[2];
        vertCount += 2;
      }
      entry.geometry.setAttribute('position', new THREE.BufferAttribute(flat, 3));
      entry.geometry.setDrawRange(0, vertCount);
      entry.geometry.computeBoundingSphere();

      if (n > 0) {
        const last = s.points[n - 1];
        entry.marker.position.set(last[0], last[1], last[2]);
        entry.marker.visible = true;
      } else {
        entry.marker.visible = false;
      }
    }
  }

  _disposeEntry(entry) {
    this._seriesGroup.remove(entry.line, entry.marker);
    entry.geometry.dispose();
    entry.line.material.dispose();
    entry.marker.geometry.dispose();
    entry.marker.material.dispose();
  }

  resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  _animate() {
    this._raf = requestAnimationFrame(this._animate);
    this.controls.update();
    this._applyMarkerNlips();
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * NLIPS for this plot's latest-point markers: scale each marker's radius
   * by its distance from THIS plot's own camera (every plot card has an
   * independent scene/camera/OrbitControls — see the module comment), so a
   * marker far from the camera (e.g. after the user rotates the view)
   * doesn't shrink into invisibility under perspective. Mirrors the
   * viewport's per-body NLIPS approach (src/viewport/viewport.js) but tuned
   * for this renderer's normalized [-1,1]^3 cube rather than AU distances —
   * read live every frame since it depends on the live camera position
   * (OrbitControls can move it at any time) as well as the shared toggle.
   */
  _applyMarkerNlips() {
    const on = displaySettings.nlips;
    for (const entry of this._seriesEntries.values()) {
      if (!entry.marker.visible) continue;
      let radius = MARKER_BASE_RADIUS;
      if (on) {
        const distance = this.camera.position.distanceTo(entry.marker.position);
        radius *= 1 + MARKER_NLIPS_K * distance;
      }
      entry.marker.scale.setScalar(radius / MARKER_BASE_RADIUS);
    }
  }

  /** Release all GPU/DOM resources. Call when the owning plot card is removed. */
  dispose() {
    if (this._raf != null) cancelAnimationFrame(this._raf);
    this._resizeObserver.disconnect();
    this.controls.dispose();
    this._unsubscribeDisplaySettings();

    for (const entry of this._seriesEntries.values()) this._disposeEntry(entry);
    this._seriesEntries.clear();

    this._axesGroup.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    });

    for (const sprite of [this._xLabel, this._yLabel, this._zLabel]) {
      sprite.material.map.dispose();
      sprite.material.dispose();
    }

    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
