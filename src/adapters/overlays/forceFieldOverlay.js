// Force vector field overlay — the viewport-side "adapter" for the pure
// ForceFieldCalculator (@core/overlays). Renders with THREE.InstancedMesh
// (one draw call, one cone glyph per grid point, oriented+scaled per
// instance) instead of individual THREE.ArrowHelper objects — ArrowHelper is
// a full Object3D per arrow (2 child meshes + matrix updates each), which
// stops scaling well past a few hundred; InstancedMesh handles tens of
// thousands of instances in one draw call, which "100x denser, in 3D" needs.
// Each glyph is a single elongated cone pointing along the local force
// direction (not a separate shaft+head) — reads fine as a direction+
// magnitude indicator at high density, and keeps this to one InstancedMesh.

import * as THREE from 'three';
import { OverlayRenderer } from '@api/OverlayRenderer.js';
import { displaySettings } from '@app/displaySettings.js';
import { ForceFieldCalculator } from '@core/overlays/ForceFieldCalculator.js';
import { excludeNearBody } from '@adapters/overlays/ratchet.js';

// Caps InstancedMesh capacity — one draw call regardless of how many
// instances are actually drawn. Sized to comfortably cover iconCount's
// slider max (see discretizationPanel.js), since decimateToLimit in each
// calculator already guarantees `points.length <= displaySettings.iconCount`.
const MAX_INSTANCES = 20000;
const CONE_RADIUS = 0.05;
const ARROW_COLOR = 0x63b3ed;
const BASE_ARROW_LENGTH = 1.2; // world units at magnitude-normalized 1.0, scale 1x
const RATCHET_EXCLUSION_RADIUS = 1.0; // see forceFieldOverlay's sibling bug fix
const MAX_NORMALIZED_MAGNITUDE = 2;

const UP = new THREE.Vector3(0, 1, 0);

export class ForceFieldOverlay extends OverlayRenderer {
  constructor(scene, toThree) {
    super();
    this.scene = scene;
    this.toThree = toThree;
    this.calculator = new ForceFieldCalculator();

    // ConeGeometry's default axis is +Y, height 1 (spans y=-0.5..0.5) — the
    // per-instance transform below rotates that axis to each point's force
    // direction and scales it to that point's arrow length.
    const geometry = new THREE.ConeGeometry(CONE_RADIUS, 1, 6);
    const material = new THREE.MeshBasicMaterial({ color: ARROW_COLOR });
    this.mesh = new THREE.InstancedMesh(geometry, material, MAX_INSTANCES);
    this.mesh.visible = displaySettings.showForceField;
    this.mesh.count = 0; // nothing drawn until the first update()
    scene.add(this.mesh);

    displaySettings.onChange((s) => {
      this.mesh.visible = s.showForceField;
    });

    this.maxMagnitudeSeen = 1e-9;

    this._matrix = new THREE.Matrix4();
    this._quaternion = new THREE.Quaternion();
    this._position = new THREE.Vector3();
    this._direction = new THREE.Vector3();
    this._scale = new THREE.Vector3();
  }

  update(relBodies) {
    if (!displaySettings.showForceField) return;

    const points = this.calculator.compute(relBodies, {
      drawRadius: displaySettings.drawRadius,
      radiusIterations: displaySettings.radiusIterations,
      thetaIterations: displaySettings.thetaIterations,
      phiIterations: displaySettings.phiIterations,
      skew: displaySettings.magnitudeModSkewAll,
      iconCount: displaySettings.iconCount,
    });

    for (const p of points) {
      if (excludeNearBody(p.position, relBodies, RATCHET_EXCLUSION_RADIUS)) continue;
      if (p.magnitude > this.maxMagnitudeSeen) this.maxMagnitudeSeen = p.magnitude;
    }

    const scale = displaySettings.forceFieldScale;
    // `scale` is a gamma-curve exponent on the magnitude->size mapping, not a
    // flat length multiplier: displayedMag = normalizedMag ** (1/scale).
    // scale=1 is identity (unchanged from before). scale>1 (gamma<1) boosts
    // weak/far-field magnitudes relative to strong/near ones — arrows far
    // from a body read relatively "stronger" than the true 1/r^2 falloff
    // would render them. scale<1 (gamma>1) does the opposite, compressing
    // weak signals further toward invisible. Slider is clamped to a strictly
    // positive range (see displayOptions.js) so gamma never goes non-finite.
    const gamma = 1 / scale;
    let instanceCount = 0;

    for (const p of points) {
      const normalizedMag = Math.min(MAX_NORMALIZED_MAGNITUDE, p.magnitude / this.maxMagnitudeSeen);
      // Capped again AFTER the curve: gamma>1 (scale<1) expands values above
      // the pivot (normalizedMag=1) as well as compressing values below it,
      // so an uncapped result can blow up arrow length for low scale values.
      const displayedMag = Math.min(MAX_NORMALIZED_MAGNITUDE, Math.pow(Math.max(0, normalizedMag), gamma));
      // magnitudeModForceField is an orthogonal rendered-magnitude multiplier
      // (separate axis from forceFieldScale's gamma curve and from
      // magnitudeModSkewAll's sampling-density skew).
      const length = Math.max(0, displayedMag * BASE_ARROW_LENGTH * displaySettings.magnitudeModForceField);
      if (length <= 1e-6) continue;

      this._position.copy(this.toThree(p.position));
      this._direction.copy(this.toThree(p.vector)).normalize();
      this._quaternion.setFromUnitVectors(UP, this._direction);
      this._scale.set(1, length, 1);
      this._matrix.compose(this._position, this._quaternion, this._scale);
      this.mesh.setMatrixAt(instanceCount, this._matrix);
      instanceCount++;
    }

    this.mesh.count = instanceCount;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.scene.remove(this.mesh);
  }
}
