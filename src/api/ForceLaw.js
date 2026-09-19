// Interface: the force law an N-body integrator advances state with. Pure
// math over plain data (a packed state vector + body list), no THREE.js/DOM
// dependency — concrete implementations live in @core, not @adapters, same
// reasoning as @api/FieldCalculator.js.
export class ForceLaw {
  /**
   * @param {Float64Array} state  Packed [x,y,z,vx,vy,vz, ...] per body.
   * @param {import('../core/Body.js').Body[]} bodies
   * @param {number} softening
   * @returns {Float64Array} d/dt of `state`: [vel, acc, ...] per body.
   */
  derivatives(state, bodies, softening) {
    throw new Error(`${this.constructor.name} must implement derivatives()`);
  }
}
