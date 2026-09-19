import { ForceFieldCalculator } from '@core/overlays/ForceFieldCalculator.js';
import { PotentialFieldCalculator } from '@core/overlays/PotentialFieldCalculator.js';
import { EquipotentialLinesCalculator } from '@core/overlays/EquipotentialLinesCalculator.js';
import { JacobiPotentialCalculator } from '@core/overlays/JacobiPotentialCalculator.js';
import { LagrangePointsCalculator } from '@core/overlays/LagrangePointsCalculator.js';
import { FieldLinesCalculator } from '@core/overlays/FieldLinesCalculator.js';

/** Composition-root factory for @api/FieldCalculator.js implementations. */
export class FieldCalculatorProvider {
  provideForceFieldCalculator() {
    return new ForceFieldCalculator();
  }

  providePotentialFieldCalculator() {
    return new PotentialFieldCalculator();
  }

  provideEquipotentialLinesCalculator() {
    return new EquipotentialLinesCalculator();
  }

  provideJacobiPotentialCalculator() {
    return new JacobiPotentialCalculator();
  }

  provideLagrangePointsCalculator() {
    return new LagrangePointsCalculator();
  }

  provideFieldLinesCalculator() {
    return new FieldLinesCalculator();
  }
}

export const fieldCalculatorProvider = new FieldCalculatorProvider();
