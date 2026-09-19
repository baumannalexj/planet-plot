import * as THREE from 'three';
import { OverlayRenderer } from '@api/OverlayRenderer.js';
import { displaySettings } from '@app/displaySettings.js';
import { PotentialFieldCalculator } from '@core/overlays/PotentialFieldCalculator.js';
import { shellRingSizes } from '@core/overlays/DiscretizationGrid.js';
import { excludeNearBody } from '@adapters/overlays/ratchet.js';

const ATTRACTIVE_COLOR = new THREE.Color(0x9f7aea);
const ZERO_COLOR = new THREE.Color(0x4a5568);
const RATCHET_EXCLUSION_RADIUS = 1.0;
const MAX_NORMALIZED_MAGNITUDE = 2;
const FADE_START_FRACTION = 0.6;

// Cylindrical (hypot(x,y), no z) fade toward transparent near the draw radius —
// a smoothstep, not a hard clip, so the mesh's edge doesn't read as a sharp ring.
function radialFade(x, y, r) {
  const d = Math.hypot(x, y);
  const t = THREE.MathUtils.clamp((d - FADE_START_FRACTION * r) / (r - FADE_START_FRACTION * r), 0, 1);
  return 1 - THREE.MathUtils.smoothstep(t, 0, 1);
}

/**
 * Slice the flat `points` array PotentialFieldCalculator returns back into
 * per-shell rings, in the order they were produced — see
 * DiscretizationGrid.shellRingSizes. Same technique
 * EquipotentialLinesCalculator uses to re-derive adjacency now that sampling
 * moved from a rectangular grid to shells of rings.
 */
function groupIntoShells(points, radiusIterations, thetaIterations, skew) {
  const ringSizes = shellRingSizes(radiusIterations, thetaIterations, skew, true);
  const shells = [];
  let offset = 0;
  for (const size of ringSizes) {
    shells.push(points.slice(offset, offset + size));
    offset += size;
  }
  return shells;
}

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
    this.currentLayoutKey = null;
    this.currentTriangleCount = 0;

    displaySettings.onChange((s) => {
      this.group.visible = s.showPotentialField;
    });

    this.maxMagnitudeSeen = 1e-9;
  }

  // Rebuilds the surface as a triangle strip between each pair of adjacent
  // shells' rings — NOT a rectangular PlaneGeometry grid, since
  // PotentialFieldCalculator now samples shells of rings (see
  // DiscretizationGrid.computeShellGrid), not a rectangular w*h mesh. Ring
  // sizes can differ between shells (skew != 0), so each inner-ring point is
  // matched to the proportionally-nearest theta index on the outer ring —
  // same adjacency scheme EquipotentialLinesCalculator uses. Known
  // limitation: there's a small unfilled hole at the very center (inside the
  // innermost shell) — a first-pass tradeoff, not worth a dedicated center
  // point for the gain in visual completeness.
  buildMesh(triangleCount) {
    if (this.mesh) {
      this.group.remove(this.mesh);
      this.geometry.dispose();
      this.material.dispose();
    }
    this.geometry = new THREE.BufferGeometry();
    const vertexCount = triangleCount * 3;
    this.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertexCount * 3), 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(vertexCount * 4), 4));
    this.material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.group.add(this.mesh);
    this.currentTriangleCount = triangleCount;
  }

  update(relBodies) {
    if (!displaySettings.showPotentialField) return;

    const { drawRadius, radiusIterations, thetaIterations, magnitudeModSkewAll: skew, potentialFieldZ: z } = displaySettings;
    const points = this.calculator.compute(relBodies, { drawRadius, radiusIterations, thetaIterations, skew, z });
    if (points.length === 0) return;

    for (const p of points) {
      if (excludeNearBody(p.position, relBodies, RATCHET_EXCLUSION_RADIUS)) continue;
      const mag = Math.abs(p.value);
      if (mag > this.maxMagnitudeSeen) this.maxMagnitudeSeen = mag;
    }

    const scale = displaySettings.potentialFieldScale * displaySettings.magnitudeModPotential;

    // Per-point displayed displacement + color, computed once and reused for
    // every triangle vertex that references this point.
    for (const p of points) {
      const normalizedVal = p.value / this.maxMagnitudeSeen;
      const normalizedMag = Math.min(MAX_NORMALIZED_MAGNITUDE, Math.abs(normalizedVal));
      p._displacement = (normalizedVal < 0 ? -normalizedMag : normalizedMag) * scale;
      const t = Math.max(0, -normalizedVal);
      p._color = new THREE.Color().lerpColors(ZERO_COLOR, ATTRACTIVE_COLOR, t);
      p._alpha = radialFade(p.position[0], p.position[1], drawRadius);
    }

    const shells = groupIntoShells(points, radiusIterations, thetaIterations, skew);

    let triangleCount = 0;
    for (let s = 0; s < shells.length - 1; s++) {
      triangleCount += shells[s].length * 2;
    }

    const layoutKey = `${radiusIterations}|${thetaIterations}|${skew}`;
    if (layoutKey !== this.currentLayoutKey || triangleCount !== this.currentTriangleCount) {
      this.buildMesh(triangleCount);
      this.currentLayoutKey = layoutKey;
    }

    const posArray = this.geometry.attributes.position.array;
    const colArray = this.geometry.attributes.color.array;
    let vertexIdx = 0;

    const writeVertex = (p) => {
      const idx = vertexIdx * 3;
      const cIdx = vertexIdx * 4;
      posArray[idx] = p.position[0];
      posArray[idx + 1] = p.position[1];
      posArray[idx + 2] = p._displacement;
      colArray[cIdx] = p._color.r;
      colArray[cIdx + 1] = p._color.g;
      colArray[cIdx + 2] = p._color.b;
      colArray[cIdx + 3] = p._alpha;
      vertexIdx++;
    };

    for (let s = 0; s < shells.length - 1; s++) {
      const ringA = shells[s];
      const ringB = shells[s + 1];
      const nA = ringA.length;
      const nB = ringB.length;
      if (nA === 0 || nB === 0) continue;
      for (let i = 0; i < nA; i++) {
        const a0 = ringA[i];
        const a1 = ringA[(i + 1) % nA];
        const j = Math.round((i / nA) * nB) % nB;
        const b0 = ringB[j];
        const b1 = ringB[(j + 1) % nB];
        writeVertex(a0);
        writeVertex(a1);
        writeVertex(b0);
        writeVertex(a1);
        writeVertex(b1);
        writeVertex(b0);
      }
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
    this.geometry.computeBoundingSphere();

    this.mesh.position.y = z;
  }

  dispose() {
    if (this.geometry) this.geometry.dispose();
    if (this.material) this.material.dispose();
    this.scene.remove(this.group);
  }
}
