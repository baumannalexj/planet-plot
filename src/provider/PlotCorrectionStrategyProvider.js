import { CircularEmbeddingCorrection } from '@adapters/plotCorrections/circularEmbedding.js';
import { NoopPlotCorrection } from '@adapters/plotCorrections/noop.js';

/** Composition-root factory for @api/PlotCorrectionStrategy.js implementations. */
export class PlotCorrectionStrategyProvider {
  provideCircularEmbeddingCorrection() {
    return new CircularEmbeddingCorrection();
  }

  provideNoopPlotCorrection() {
    return new NoopPlotCorrection();
  }
}

export const plotCorrectionStrategyProvider = new PlotCorrectionStrategyProvider();
