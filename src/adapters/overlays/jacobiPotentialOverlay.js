import * as THREE from 'three';
import { OverlayRenderer } from '@api/OverlayRenderer.js';
import { displaySettings } from '@app/displaySettings.js';
import { JacobiPotentialCalculator } from '@core/overlays/JacobiPotentialCalculator.js';
import { excludeNearBody } from '@adapters/overlays/ratchet.js';

const ATTRACTIVE_COLOR = new THREE.Color(0xed8936);
const ZERO_COLOR = new THREE.Color(0x4a5568);
const RATCHET_EXCLUSION_RADIUS = 1.0;
const MAX_NORMALIZED_MAGNITUDE = 2;
const FADE_START_FRACTION = 0.6;

// Cylindrical (hypot(x,y), no z) fade toward transparent near the draw radius —
// mirrors PotentialFieldOverlay's fade so the two surfaces read consistently.
function radialFade(x, y, r) {
  const d = Math.hypot(x, y);
  const t = THREE.MathUtils.clamp((d - FADE_START_FRACTION * r) / (r - FADE_START_FRACTION * r), 0, 1);
  return 1 - THREE.MathUtils.smoothstep(t, 0, 1);
}

export class JacobiPotentialOverlay extends OverlayRenderer {
  constructor(scene, toThree) {
    super();
    this.scene = scene;
    this.toThree = toThree;
    this.calculator = new JacobiPotentialCalculator();

    this.group = new THREE.Group();
    this.group.visible = displaySettings.showJacobiPotential;
    scene.add(this.group);

    this.geometry = null;
    this.material = null;
    this.mesh = null;
    this.currentResolution = -1;
    this.currentRadius = -1;

    displaySettings.onChange((s) => {
      this.group.visible = s.showJacobiPotential;
    });

    this.maxMagnitudeSeen = 1e-9;
  }

  buildMesh(resolution) {
    if (this.mesh) {
      this.group.remove(this.mesh);
      this.geometry.dispose();
      this.material.dispose();
    }
    const extent = displaySettings.potentialFieldRadius;
    this.geometry = new THREE.PlaneGeometry(extent * 2, extent * 2, resolution - 1, resolution - 1);
    const positions = this.geometry.attributes.position.array;
    const vertexCount = positions.length / 3;
    const colors = new Float32Array(vertexCount * 4);
    this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));
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
    this.currentRadius = extent;
  }

  update(relBodies) {
    if (!displaySettings.showJacobiPotential) return;

    const resolution = Math.max(4, Math.round(displaySettings.potentialFieldResolution));
    const radius = displaySettings.potentialFieldRadius;
    if (resolution !== this.currentResolution || radius !== this.currentRadius) this.buildMesh(resolution);

    const points = this.calculator.compute(relBodies, {
      extent: radius,
      resolution,
      z: displaySettings.potentialFieldZ,
    });
    if (points.length === 0) return;

    for (const p of points) {
      if (excludeNearBody(p.position, relBodies, RATCHET_EXCLUSION_RADIUS)) continue;
      const mag = Math.abs(p.value);
      if (mag > this.maxMagnitudeSeen) this.maxMagnitudeSeen = mag;
    }

    const posAttr = this.geometry.attributes.position;
    const colAttr = this.geometry.attributes.color;
    const posArray = posAttr.array;
    const colArray = colAttr.array;

    const scale = displaySettings.jacobiPotentialScale;

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
      const colIdx = i * 4;
      colArray[colIdx] = color.r;
      colArray[colIdx + 1] = color.g;
      colArray[colIdx + 2] = color.b;
      colArray[colIdx + 3] = radialFade(p.position[0], p.position[1], radius);
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
