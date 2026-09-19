// Interface: a per-frame viewport overlay. Implementations live in
// @adapters (three.js-specific — the whole reason this needs an adapter
// separate from the @core calculator it wraps).
export class OverlayRenderer {
  /** @param {object[]} relBodies  snapshot.relativeBodies(origin) for this frame. */
  update(relBodies) {
    throw new Error(`${this.constructor.name} must implement update()`);
  }

  /** Release GPU/DOM resources. */
  dispose() {
    throw new Error(`${this.constructor.name} must implement dispose()`);
  }
}
