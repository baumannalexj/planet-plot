// Interface: how a plot handles periodic axes/discontinuities. Concrete
// implementations live in @adapters/plotCorrections (they're swappable
// strategies the plot depends on, not domain logic).
export class PlotCorrectionStrategy {
  /**
   * @param {('x'|'y'|'z')[]} activeSlots
   * @param {(slot: 'x'|'y'|'z') => boolean} isPeriodicSlot
   * @returns {{ringSlot: 'x'|'y'|'z', radiusSlot: ('x'|'y'|'z')|null, heightSlot: ('x'|'y'|'z')|null} | null}
   */
  computePlan(activeSlots, isPeriodicSlot) {
    throw new Error(`${this.constructor.name} must implement computePlan()`);
  }

  /** @returns {[number, number, number]} */
  buildPoint(ctx) {
    throw new Error(`${this.constructor.name} must implement buildPoint()`);
  }

  /** @returns {boolean} */
  isBreak(ctx) {
    throw new Error(`${this.constructor.name} must implement isBreak()`);
  }
}
