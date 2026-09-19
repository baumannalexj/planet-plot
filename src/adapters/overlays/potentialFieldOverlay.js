import * as THREE from 'three';
import { OverlayRenderer } from '@api/OverlayRenderer.js';
import { displaySettings } from '@app/displaySettings.js';
import { PotentialFieldCalculator } from '@core/overlays/PotentialFieldCalculator.js';
import { excludeNearBody } from '@adapters/overlays/ratchet.js';

const GRID_EXTENT = 20;
const ATTRACTIVE_COLOR = new THREE.Color(0x9f7aea);
const ZERO_COLOR = new THREE.Color(0x4a5568);
const RATCHET_EXCLUSION_RADIUS = 1.0;
const MAX_NORMALIZED_MAGNITUDE = 2;

export class PotentialFieldOverlay extends OverlayRenderer {
  constructor(scene, toThree) {
    super();
    this.scene = scene;
    this.toThree = toThree;
    this.calculator = new PotentialFieldCalculator();

    this.group = new THREE.Group();
    this.group.visible = displaySettings.showPotentialField;
    scene.add(this.group);

    this.geometry = null;
    this.material = null;
    this.mesh = null;
    this.currentResolution = -1;

    displaySettings.onChange((s) => {
      this.group.visible = s.showPotentialField;
    });

    this.maxMagnitudeSeen = 1e-9;
  }

  buildMesh(resolution) {
    if (this.mesh) {
      this.group.remove(this.mesh);
      this.geometry.dispose();
      this.material.dispose();
    }
    this.geometry = new THREE.PlaneGeometry(GRID_EXTENT * 2, GRID_EXTENT * 2, resolution - 1, resolution - 1);
    const positions = this.geometry.attributes.position.array;
    const colors = new Float32Array(positions.length);
    this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.group.add(this.mesh);
    this.currentResolution = resolution;
  }

  update(relBodies) {
    if (!displaySettings.showPotentialField) return;

    const resolution = Math.max(4, Math.round(displaySettings.potentialFieldResolution));
    if (resolution !== this.currentResolution) this.buildMesh(resolution);

    const points = this.calculator.compute(relBodies, {
      extent: GRID_EXTENT,
      resolution,
      z: displaySettings.potentialFieldZ,
    });

    for (const p of points) {
      if (excludeNearBody(p.position, relBodies, RATCHET_EXCLUSION_RADIUS)) continue;
      const mag = Math.abs(p.value);
      if (mag > this.maxMagnitudeSeen) this.maxMagnitudeSeen = mag;
    }

    const posAttr = this.geometry.attributes.position;
    const colAttr = this.geometry.attributes.color;
    const posArray = posAttr.array;
    const colArray = colAttr.array;

    const scale = displaySettings.potentialFieldScale;

    points.forEach((p, i) => {
      const normalizedVal = p.value / this.maxMagnitudeSeen;
      const normalizedMag = Math.min(MAX_NORMALIZED_MAGNITUDE, Math.abs(normalizedVal));
      const displacement = (normalizedVal < 0 ? -normalizedMag : normalizedMag) * scale;
      const posIdx = i * 3;
      posArray[posIdx] = p.position[0];
      posArray[posIdx + 1] = p.position[1];
      posArray[posIdx + 2] = displacement;

      const t = Math.max(0, -normalizedVal);
      const color = new THREE.Color().lerpColors(ZERO_COLOR, ATTRACTIVE_COLOR, t);
      const colIdx = i * 3;
      colArray[colIdx] = color.r;
      colArray[colIdx + 1] = color.g;
      colArray[colIdx + 2] = color.b;
    });

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;

    this.mesh.position.y = displaySettings.potentialFieldZ;
  }

  dispose() {
    if (this.geometry) this.geometry.dispose();
    if (this.material) this.material.dispose();
    this.scene.remove(this.group);
  }
}
