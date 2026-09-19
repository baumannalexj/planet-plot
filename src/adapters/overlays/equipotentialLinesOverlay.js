import * as THREE from 'three';
import { OverlayRenderer } from '@api/OverlayRenderer.js';
import { displaySettings } from '@app/displaySettings.js';
import { PotentialFieldCalculator } from '@core/overlays/PotentialFieldCalculator.js';
import { EquipotentialLinesCalculator } from '@core/overlays/EquipotentialLinesCalculator.js';
import { excludeNearBody } from '@adapters/overlays/ratchet.js';

const ATTRACTIVE_COLOR = new THREE.Color(0x9f7aea);
const ZERO_COLOR = new THREE.Color(0x4a5568);
const RATCHET_EXCLUSION_RADIUS = 1.0;
const FADE_START_FRACTION = 0.6;

// Cylindrical (hypot(x,y), no z) fade toward transparent near the draw radius —
// a smoothstep, not a hard clip, so lines don't just vanish at a sharp edge.
function radialFade(x, y, r) {
  const d = Math.hypot(x, y);
  const t = THREE.MathUtils.clamp((d - FADE_START_FRACTION * r) / (r - FADE_START_FRACTION * r), 0, 1);
  return 1 - THREE.MathUtils.smoothstep(t, 0, 1);
}

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
      geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(0), 4));
      const material = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true });
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
    const radius = displaySettings.potentialFieldRadius;

    const points = this.potentialCalculator.compute(relBodies, { extent: radius, resolution, z });
    for (const p of points) {
      if (excludeNearBody(p.position, relBodies, RATCHET_EXCLUSION_RADIUS)) continue;
      if (p.value < this.minValueSeen) this.minValueSeen = p.value;
    }

    const N = Math.max(2, Math.round(displaySettings.equipotentialLineCount));
    const levels = [];
    for (let k = 0; k < N; k++) {
      levels.push((this.minValueSeen * (k + 1)) / (N + 1));
    }

    const contours = this.calculator.compute(relBodies, { extent: radius, resolution, z, levels });
    this.ensureLineCount(N);

    contours.forEach((contour, k) => {
      const line = this.lines[k];
      const segCount = contour.segments.length;
      if (segCount !== line.segmentCount) {
        const positions = new Float32Array(segCount * 6);
        line.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const colors = new Float32Array(segCount * 8);
        line.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));
        line.segmentCount = segCount;
      }
      const posArray = line.geometry.attributes.position.array;
      const colArray = line.geometry.attributes.color.array;
      const t = N > 1 ? k / (N - 1) : 0;
      const levelColor = new THREE.Color().lerpColors(ZERO_COLOR, ATTRACTIVE_COLOR, t);
      contour.segments.forEach((seg, i) => {
        const idx = i * 6;
        posArray[idx] = seg[0];
        posArray[idx + 1] = seg[1];
        posArray[idx + 2] = 0;
        posArray[idx + 3] = seg[3];
        posArray[idx + 4] = seg[4];
        posArray[idx + 5] = 0;

        const cIdx = i * 8;
        const alpha0 = radialFade(seg[0], seg[1], radius);
        const alpha1 = radialFade(seg[3], seg[4], radius);
        colArray[cIdx] = levelColor.r;
        colArray[cIdx + 1] = levelColor.g;
        colArray[cIdx + 2] = levelColor.b;
        colArray[cIdx + 3] = alpha0;
        colArray[cIdx + 4] = levelColor.r;
        colArray[cIdx + 5] = levelColor.g;
        colArray[cIdx + 6] = levelColor.b;
        colArray[cIdx + 7] = alpha1;
      });
      line.geometry.attributes.position.needsUpdate = true;
      line.geometry.attributes.color.needsUpdate = true;
      line.geometry.computeBoundingSphere();
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
