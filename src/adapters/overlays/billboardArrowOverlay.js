// Camera-facing 2D arrow billboards for the force field — an alternative to
// ForceFieldOverlay's 3D-oriented cone glyphs ("quiver plot" look). Reuses
// ForceFieldCalculator unmodified (same {position, vector, magnitude}[]
// output, same excludeNearBody/ratchet pattern as forceFieldOverlay.js) and
// only differs in the rendering half: one InstancedMesh of quads, each
// transformed per-frame into a camera-facing billboard whose in-plane
// rotation matches the force vector's screen-space projected angle.

import * as THREE from 'three';
import { OverlayRenderer } from '@api/OverlayRenderer.js';
import { displaySettings } from '@app/displaySettings.js';
import { ForceFieldCalculator } from '@core/overlays/ForceFieldCalculator.js';
import { excludeNearBody } from '@adapters/overlays/ratchet.js';
import { ARROW_STYLES } from '@adapters/overlays/arrowStyles.js';

const MAX_INSTANCES = 20000; // matches ForceFieldOverlay's instance cap
const RATCHET_EXCLUSION_RADIUS = 1.0;
const MAX_NORMALIZED_MAGNITUDE = 2;
const BASE_ARROW_SIZE = 1.0; // world units at magnitude-normalized 1.0, scale 1x
const ARROW_COLOR = 0xf6ad55;

/** Draw a right-pointing quiver arrow into a canvas texture, using the named style from ARROW_STYLES. */
function makeArrowTexture(styleKey) {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const draw = ARROW_STYLES[styleKey] ?? ARROW_STYLES.chevron;
  draw(ctx, size);
  return new THREE.CanvasTexture(canvas);
}

export class BillboardArrowOverlay extends OverlayRenderer {
  constructor(scene, toThree, camera) {
    super();
    this.scene = scene;
    this.toThree = toThree;
    this.camera = camera;
    this.calculator = new ForceFieldCalculator();

    this.currentArrowStyle = displaySettings.arrowStyle;

    const geometry = new THREE.PlaneGeometry(1, 1);
    const material = new THREE.MeshBasicMaterial({
      map: makeArrowTexture(this.currentArrowStyle),
      color: ARROW_COLOR,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.mesh = new THREE.InstancedMesh(geometry, material, MAX_INSTANCES);
    this.mesh.visible = displaySettings.showBillboardArrows;
    this.mesh.count = 0; // nothing drawn until the first update()
    scene.add(this.mesh);

    displaySettings.onChange((s) => {
      this.mesh.visible = s.showBillboardArrows;
    });

    this.maxMagnitudeSeen = 1e-9;

    this._matrix = new THREE.Matrix4();
    this._quaternion = new THREE.Quaternion();
    this._basisMatrix = new THREE.Matrix4();
    this._axisX = new THREE.Vector3();
    this._axisY = new THREE.Vector3();
    this._position = new THREE.Vector3();
    this._worldDirection = new THREE.Vector3();
    this._toCameraDir = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._up = new THREE.Vector3();
    this._scale = new THREE.Vector3();
  }

  update(relBodies) {
    if (!displaySettings.showBillboardArrows) return;

    if (displaySettings.arrowStyle !== this.currentArrowStyle) {
      this.currentArrowStyle = displaySettings.arrowStyle;
      this.mesh.material.map.dispose();
      this.mesh.material.map = makeArrowTexture(this.currentArrowStyle);
      this.mesh.material.needsUpdate = true;
    }

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

    this._right.setFromMatrixColumn(this.camera.matrixWorld, 0);
    this._up.setFromMatrixColumn(this.camera.matrixWorld, 1);

    const scale = displaySettings.forceFieldScale;
    // Same gamma-curve mapping as forceFieldOverlay.js — see its comment for
    // the full rationale. Shared slider, shared curve, since both overlays
    // render the same underlying ForceFieldCalculator data.
    const gamma = 1 / scale;
    let instanceCount = 0;

    for (const p of points) {
      const normalizedMag = Math.min(MAX_NORMALIZED_MAGNITUDE, p.magnitude / this.maxMagnitudeSeen);
      const displayedMag = Math.min(MAX_NORMALIZED_MAGNITUDE, Math.pow(Math.max(0, normalizedMag), gamma));
      const size = Math.max(0, displayedMag * BASE_ARROW_SIZE * displaySettings.magnitudeModForceField);
      if (size <= 1e-6) continue;

      this._position.copy(this.toThree(p.position));
      this._worldDirection.copy(this.toThree(p.vector)).normalize();

      // Screen-space angle of the force vector, projected onto the camera's
      // own right/up basis.
      const vx = this._worldDirection.dot(this._right);
      const vy = this._worldDirection.dot(this._up);
      const angle = Math.atan2(vy, vx);

      // Build the billboard's on-screen X/Y axes DIRECTLY from the camera's
      // actual right/up vectors, rotated by `angle` within the camera's own
      // view plane. This is deliberately NOT
      // Quaternion.setFromUnitVectors(quadNormal, toCameraDir): that finds
      // *some* shortest rotation mapping normal->toCameraDir, but doesn't
      // constrain roll — the resulting local X/Y axes drift out of alignment
      // with the camera's actual right/up as the camera orbits, so the
      // visible on-screen angle silently diverges from the computed `angle`
      // except in the degenerate case where the camera looks straight down
      // its own axis at the instance. Building the basis from camera.right/
      // camera.up directly has no such ambiguity — the quad's axes ARE the
      // (rotated) camera axes, always.
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      this._axisX.set(
        this._right.x * cosA + this._up.x * sinA,
        this._right.y * cosA + this._up.y * sinA,
        this._right.z * cosA + this._up.z * sinA
      );
      this._axisY.set(
        this._up.x * cosA - this._right.x * sinA,
        this._up.y * cosA - this._right.y * sinA,
        this._up.z * cosA - this._right.z * sinA
      );
      this._toCameraDir.subVectors(this.camera.position, this._position).normalize();
      this._basisMatrix.makeBasis(this._axisX, this._axisY, this._toCameraDir);
      this._quaternion.setFromRotationMatrix(this._basisMatrix);

      this._scale.set(size, size, 1);
      this._matrix.compose(this._position, this._quaternion, this._scale);
      this.mesh.setMatrixAt(instanceCount, this._matrix);
      instanceCount++;
    }

    this.mesh.count = instanceCount;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.map.dispose();
    this.mesh.material.dispose();
    this.scene.remove(this.mesh);
  }
}
