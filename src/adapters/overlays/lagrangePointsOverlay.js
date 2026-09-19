import * as THREE from 'three';
import { OverlayRenderer } from '@api/OverlayRenderer.js';
import { displaySettings } from '@app/displaySettings.js';
import { LagrangePointsCalculator } from '@core/overlays/LagrangePointsCalculator.js';

const MARKER_RADIUS = 0.1;
const MARKER_COLOR = 0xf6ad55;

export class LagrangePointsOverlay extends OverlayRenderer {
  constructor(scene, toThree) {
    super();
    this.scene = scene;
    this.toThree = toThree;
    this.calculator = new LagrangePointsCalculator(); // this should be injected by main via a @provider directory

    this.group = new THREE.Group();
    this.group.visible = displaySettings.showLagrangePoints;
    scene.add(this.group);

    this.markers = ['L1', 'L2', 'L3', 'L4', 'L5'].map((id) => {
      const geometry = new THREE.OctahedronGeometry(MARKER_RADIUS, 0);
      const material = new THREE.MeshBasicMaterial({ color: MARKER_COLOR, wireframe: true });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.visible = false;
      this.group.add(mesh);
      return { id, mesh };
    });

    displaySettings.onChange((s) => {
      this.group.visible = s.showLagrangePoints;
    });
  }

  update(relBodies) {
    if (!displaySettings.showLagrangePoints) return;
    const points = this.calculator.compute(relBodies);
    for (const marker of this.markers) {
      const point = points.find((p) => p.id === marker.id);
      marker.mesh.visible = !!point;
      if (point) marker.mesh.position.copy(this.toThree(point.position));
    }
  }

  dispose() {
    for (const marker of this.markers) {
      marker.mesh.geometry.dispose();
      marker.mesh.material.dispose();
    }
    this.scene.remove(this.group);
  }
}
