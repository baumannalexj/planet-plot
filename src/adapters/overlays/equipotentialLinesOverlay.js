import * as THREE from 'three';
import { OverlayRenderer } from '@api/OverlayRenderer.js';
import { displaySettings } from '@app/displaySettings.js';
import { PotentialFieldCalculator } from '@core/overlays/PotentialFieldCalculator.js';
import { EquipotentialLinesCalculator } from '@core/overlays/EquipotentialLinesCalculator.js';
import { excludeNearBody } from '@adapters/overlays/ratchet.js';

const GRID_EXTENT = 20;
const ATTRACTIVE_COLOR = new THREE.Color(0x9f7aea);
const ZERO_COLOR = new THREE.Color(0x4a5568);
const RATCHET_EXCLUSION_RADIUS = 1.0;

export class EquipotentialLinesOverlay extends OverlayRenderer {
  constructor(scene, toThree) {
    super();
    this.scene = scene;
    this.toThree = toThree;
    this.potentialCalculator = new PotentialFieldCalculator();
    this.calculator = new EquipotentialLinesCalculator();

    this.group = new THREE.Group();
    this.group.visible = displaySettings.showEquipotentialLines;
    this.group.rotation.x = -Math.PI / 2;
    scene.add(this.group);

    /** @type {{mesh: THREE.LineSegments, geometry: THREE.BufferGeometry, material: THREE.LineBasicMaterial, segmentCount: number}[]} */
    this.lines = [];
    this.minValueSeen = -1e-9;

    displaySettings.onChange((s) => {
      this.group.visible = s.showEquipotentialLines;
    });
  }

  ensureLineCount(n) {
    while (this.lines.length < n) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
      const material = new THREE.LineBasicMaterial({ color: ZERO_COLOR.clone() });
      const mesh = new THREE.LineSegments(geometry, material);
      this.group.add(mesh);
      this.lines.push({ mesh, geometry, material, segmentCount: 0 });
    }
    while (this.lines.length > n) {
      const line = this.lines.pop();
      this.group.remove(line.mesh);
      line.geometry.dispose();
      line.material.dispose();
    }
  }

  update(relBodies) {
    if (!displaySettings.showEquipotentialLines) return;

    const resolution = Math.max(4, Math.round(displaySettings.potentialFieldResolution));
    const z = displaySettings.potentialFieldZ;

    const points = this.potentialCalculator.compute(relBodies, { extent: GRID_EXTENT, resolution, z });
    for (const p of points) {
      if (excludeNearBody(p.position, relBodies, RATCHET_EXCLUSION_RADIUS)) continue;
      if (p.value < this.minValueSeen) this.minValueSeen = p.value;
    }

    const N = Math.max(2, Math.round(displaySettings.equipotentialLineCount));
    const levels = [];
    for (let k = 0; k < N; k++) {
      levels.push((this.minValueSeen * (k + 1)) / (N + 1));
    }

    const contours = this.calculator.compute(relBodies, { extent: GRID_EXTENT, resolution, z, levels });
    this.ensureLineCount(N);

    contours.forEach((contour, k) => {
      const line = this.lines[k];
      const segCount = contour.segments.length;
      if (segCount !== line.segmentCount) {
        const positions = new Float32Array(segCount * 6);
        line.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        line.segmentCount = segCount;
      }
      const posArray = line.geometry.attributes.position.array;
      contour.segments.forEach((seg, i) => {
        const idx = i * 6;
        posArray[idx] = seg[0];
        posArray[idx + 1] = seg[1];
        posArray[idx + 2] = 0;
        posArray[idx + 3] = seg[3];
        posArray[idx + 4] = seg[4];
        posArray[idx + 5] = 0;
      });
      line.geometry.attributes.position.needsUpdate = true;
      line.geometry.computeBoundingSphere();

      const t = N > 1 ? k / (N - 1) : 0;
      line.material.color.lerpColors(ZERO_COLOR, ATTRACTIVE_COLOR, t);
    });

    this.group.position.y = z;
  }

  dispose() {
    for (const line of this.lines) {
      line.geometry.dispose();
      line.material.dispose();
    }
    this.scene.remove(this.group);
  }
}
