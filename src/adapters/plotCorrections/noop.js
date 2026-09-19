import { PlotCorrectionStrategy } from '@api/PlotCorrectionStrategy.js';

export class NoopPlotCorrection extends PlotCorrectionStrategy {
  computePlan() {
    return null;
  }

  buildPoint({ buf, idx, bounds, normalize }) {
    return [
      normalize(buf.x[idx], bounds.x),
      normalize(buf.y[idx], bounds.y),
      bounds.z ? normalize(buf.z[idx], bounds.z) : 0,
    ];
  }

  isBreak() {
    return false;
  }
}
