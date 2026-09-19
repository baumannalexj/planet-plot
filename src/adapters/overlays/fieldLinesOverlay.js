// Gravitational field-line overlay — streamlines traced from Fibonacci-sphere
// seeds around each body, flowing toward the attracting mass (see
// FieldLinesCalculator for the integration; this file just draws its output).

import * as THREE from 'three';
import { OverlayRenderer } from '@api/OverlayRenderer.js';
import { displaySettings } from '@app/displaySettings.js';
import { FieldLinesCalculator } from '@core/overlays/FieldLinesCalculator.js';

const LINE_COLOR = 0x9f7aea;
const ARROW_SPACING = 8;
const ARROW_RADIUS = 0.025; // diameter 0.05, height 0.15 -> 3:1 length:width
const ARROW_HEIGHT = 0.15;
const BARB_SIZE = 0.18; // world-space quad edge at scale 1x, roughly cone-sized

const UP = new THREE.Vector3(0, 1, 0);

// Small open chevron/barb (not a filled triangle), drawn once and rasterized
// to a texture — same "SVG string -> Image -> drawImage onto a
// CanvasTexture" technique as billboardArrowOverlay.js's makeArrowTexture,
// just sourced from SVG markup instead of canvas-path drawing.
const BARB_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
  '<path d="M12 14 L50 32 L12 50" fill="none" stroke="#ffffff" ' +
  'stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/** Rasterize BARB_SVG onto an offscreen canvas and return a CanvasTexture. */
function makeBarbTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  const img = new Image();
  img.onload = () => {
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(img, 0, 0, size, size);
    texture.needsUpdate = true;
  };
  img.src = 'data:image/svg+xml;base64,' + btoa(BARB_SVG);
  return texture;
}

export class FieldLinesOverlay extends OverlayRenderer {
  constructor(scene, toThree, camera) {
    super();
    this.scene = scene;
    this.toThree = toThree;
    this.camera = camera;
    this.calculator = new FieldLinesCalculator();
    this.barbTexture = makeBarbTexture();

    this.group = new THREE.Group();
    this.group.visible = displaySettings.showFieldLines;
    scene.add(this.group);

    this.lines = [];
    this.arrows = [];

    this._position = new THREE.Vector3();
    this._tangent = new THREE.Vector3();
    this._quaternion = new THREE.Quaternion();
    this._basisMatrix = new THREE.Matrix4();
    this._right = new THREE.Vector3();
    this._up = new THREE.Vector3();
    this._axisX = new THREE.Vector3();
    this._axisY = new THREE.Vector3();
    this._toCameraDir = new THREE.Vector3();

    displaySettings.onChange((s) => {
      this.group.visible = s.showFieldLines;
    });
  }

  /**
   * Camera-facing quaternion for a quad whose in-plane X axis follows
   * `direction`'s screen-space projection — same basis-from-camera-axes
   * construction as BillboardArrowOverlay.update() (see that file's comment
   * for why setFromUnitVectors(normal, toCameraDir) is insufficient: it
   * leaves roll unconstrained, so the quad's on-screen angle would drift
   * from `direction` as the camera orbits).
   */
  _billboardQuaternion(position, direction) {
    this._right.setFromMatrixColumn(this.camera.matrixWorld, 0);
    this._up.setFromMatrixColumn(this.camera.matrixWorld, 1);

    const vx = direction.dot(this._right);
    const vy = direction.dot(this._up);
    const angle = Math.atan2(vy, vx);
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
    this._toCameraDir.subVectors(this.camera.position, position).normalize();
    this._basisMatrix.makeBasis(this._axisX, this._axisY, this._toCameraDir);
    this._quaternion.setFromRotationMatrix(this._basisMatrix);
    return this._quaternion;
  }

  _disposeLines() {
    for (const line of this.lines) {
      this.group.remove(line);
      line.geometry.dispose();
      line.material.dispose();
    }
    this.lines = [];
  }

  _disposeArrows() {
    for (const arrow of this.arrows) {
      this.group.remove(arrow);
      arrow.geometry.dispose();
      arrow.material.dispose();
    }
    this.arrows = [];
  }

  update(relBodies) {
    if (!displaySettings.showFieldLines) return;

    const streamlines = this.calculator.compute(relBodies, {
      drawRadius: displaySettings.drawRadius,
      radiusIterations: displaySettings.radiusIterations,
      thetaIterations: displaySettings.thetaIterations,
      phiIterations: displaySettings.phiIterations,
      skew: displaySettings.magnitudeModSkewAll,
      iconCount: displaySettings.iconCount,
    });

    this._disposeLines();
    this._disposeArrows();

    const scale = displaySettings.fieldLinesScale;
    const arrowStyle = displaySettings.fieldLineArrowStyle;

    for (const { points } of streamlines) {
      const positions = new Float32Array(points.length * 3);
      points.forEach((p, i) => {
        this.toThree(p, this._position);
        positions[i * 3] = this._position.x;
        positions[i * 3 + 1] = this._position.y;
        positions[i * 3 + 2] = this._position.z;
      });

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const material = new THREE.LineBasicMaterial({ color: LINE_COLOR, transparent: true, opacity: 0.6 });
      const line = new THREE.Line(geometry, material);
      this.group.add(line);
      this.lines.push(line);

      for (let i = 0; i + 1 < points.length; i += ARROW_SPACING) {
        const from = this.toThree(points[i], new THREE.Vector3());
        const to = this.toThree(points[i + 1], new THREE.Vector3());
        this._tangent.copy(to).sub(from).normalize();
        if (this._tangent.lengthSq() < 1e-10) continue;

        let arrow;
        if (arrowStyle === 'svg-barb') {
          const barbSize = Math.max(0, BARB_SIZE * scale);
          if (barbSize <= 1e-6) continue; // skip a degenerate zero-size quad

          const arrowGeometry = new THREE.PlaneGeometry(1, 1);
          const arrowMaterial = new THREE.MeshBasicMaterial({
            map: this.barbTexture,
            color: LINE_COLOR,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
          });
          arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
          arrow.position.copy(from);
          arrow.quaternion.copy(this._billboardQuaternion(from, this._tangent));
          arrow.scale.set(barbSize, barbSize, 1);
        } else {
          const arrowHeight = Math.max(0, ARROW_HEIGHT * scale);
          if (arrowHeight <= 1e-6) continue; // skip building a degenerate zero-size cone

          this._quaternion.setFromUnitVectors(UP, this._tangent);
          const arrowGeometry = new THREE.ConeGeometry(Math.max(0, ARROW_RADIUS * scale), arrowHeight, 6);
          const arrowMaterial = new THREE.MeshBasicMaterial({ color: LINE_COLOR });
          arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
          arrow.position.copy(from);
          arrow.quaternion.copy(this._quaternion);
        }
        this.group.add(arrow);
        this.arrows.push(arrow);
      }
    }
  }

  dispose() {
    this._disposeLines();
    this._disposeArrows();
    this.barbTexture.dispose();
    this.scene.remove(this.group);
  }
}
