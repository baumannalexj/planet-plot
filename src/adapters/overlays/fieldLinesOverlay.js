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

const UP = new THREE.Vector3(0, 1, 0);

export class FieldLinesOverlay extends OverlayRenderer {
  constructor(scene, toThree) {
    super();
    this.scene = scene;
    this.toThree = toThree;
    this.calculator = new FieldLinesCalculator();

    this.group = new THREE.Group();
    this.group.visible = displaySettings.showFieldLines;
    scene.add(this.group);

    this.lines = [];
    this.arrows = [];

    this._position = new THREE.Vector3();
    this._tangent = new THREE.Vector3();
    this._quaternion = new THREE.Quaternion();

    displaySettings.onChange((s) => {
      this.group.visible = s.showFieldLines;
    });
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
      radius: displaySettings.fieldLinesRadius,
      count: displaySettings.fieldLinesCount,
    });

    this._disposeLines();
    this._disposeArrows();

    const scale = displaySettings.fieldLinesScale;

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
        this._quaternion.setFromUnitVectors(UP, this._tangent);

        const arrowHeight = Math.max(0, ARROW_HEIGHT * scale);
        if (arrowHeight <= 1e-6) continue; // skip building a degenerate zero-size cone

        const arrowGeometry = new THREE.ConeGeometry(Math.max(0, ARROW_RADIUS * scale), arrowHeight, 6);
        const arrowMaterial = new THREE.MeshBasicMaterial({ color: LINE_COLOR });
        const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
        arrow.position.copy(from);
        arrow.quaternion.copy(this._quaternion);
        this.group.add(arrow);
        this.arrows.push(arrow);
      }
    }
  }

  dispose() {
    this._disposeLines();
    this._disposeArrows();
    this.scene.remove(this.group);
  }
}
