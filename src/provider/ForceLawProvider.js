import { NewtonianForceLaw } from '@core/NewtonianForceLaw.js';

/** Composition-root factory for @api/ForceLaw.js implementations. */
export class ForceLawProvider {
  provideNewtonianForceLaw() {
    return new NewtonianForceLaw();
  }
}

export const forceLawProvider = new ForceLawProvider();
