import { LagrangePointsOverlay } from '@adapters/overlays/lagrangePointsOverlay.js';
import { ForceFieldOverlay } from '@adapters/overlays/forceFieldOverlay.js';
import { BillboardArrowOverlay } from '@adapters/overlays/billboardArrowOverlay.js';
import { PotentialFieldOverlay } from '@adapters/overlays/potentialFieldOverlay.js';
import { EquipotentialLinesOverlay } from '@adapters/overlays/equipotentialLinesOverlay.js';
import { JacobiPotentialOverlay } from '@adapters/overlays/jacobiPotentialOverlay.js';
import { FieldLinesOverlay } from '@adapters/overlays/fieldLinesOverlay.js';

/**
 * Composition-root factory for @api/OverlayRenderer.js implementations.
 * Each `provide*` call builds a fresh instance bound to the caller's
 * scene/toThree/camera — overlays hold per-mount THREE.js state, so unlike
 * the provider itself these are never singletons.
 */
export class OverlayRendererProvider {
  provideLagrangePointsOverlay(scene, toThree) {
    return new LagrangePointsOverlay(scene, toThree);
  }

  provideForceFieldOverlay(scene, toThree) {
    return new ForceFieldOverlay(scene, toThree);
  }

  provideBillboardArrowOverlay(scene, toThree, camera) {
    return new BillboardArrowOverlay(scene, toThree, camera);
  }

  providePotentialFieldOverlay(scene, toThree) {
    return new PotentialFieldOverlay(scene, toThree);
  }

  provideEquipotentialLinesOverlay(scene, toThree) {
    return new EquipotentialLinesOverlay(scene, toThree);
  }

  provideJacobiPotentialOverlay(scene, toThree) {
    return new JacobiPotentialOverlay(scene, toThree);
  }

  provideFieldLinesOverlay(scene, toThree, camera) {
    return new FieldLinesOverlay(scene, toThree, camera);
  }
}

export const overlayRendererProvider = new OverlayRendererProvider();
