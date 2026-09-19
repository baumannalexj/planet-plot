import { CircularEmbeddingCorrection } from './circularEmbedding.js';
import { NoopPlotCorrection } from './noop.js';

export { CircularEmbeddingCorrection, NoopPlotCorrection };

export const ACTIVE_CORRECTION = new CircularEmbeddingCorrection();
