// Interface: a field/point calculator over plain body data. No THREE.js, no
// DOM — pure math. Concrete implementations live in @core (e.g.
// ForceFieldCalculator, PotentialFieldCalculator, LagrangePointsCalculator)
// since they ARE domain physics, not a separate concern needing its own
// adapter — @core is allowed to depend on @api.
export class FieldCalculator {
  /**
   * @param {{position: number[], mass: number, velocity?: number[]}[]} bodies
   * @param {object} opts
   * @returns {object[]} Implementation-specific plain-data points (e.g.
   *   {position, value} for a scalar field, {position, vector, magnitude}
   *   for a vector field, {id, position} for discrete points).
   */
  compute(bodies, opts) {
    throw new Error(`${this.constructor.name} must implement compute()`);
  }
}
