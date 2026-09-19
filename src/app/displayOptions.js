import { BooleanDisplayOption, RangeDisplayOption, SelectDisplayOption } from '@api/DisplayOption.js';

export const DISPLAY_OPTIONS = [
  new BooleanDisplayOption('massSize', 'Mass-scaled size', undefined),
  new BooleanDisplayOption('axisNames', 'Axis names', undefined),
  new BooleanDisplayOption(
    'showLagrangePoints',
    'Lagrange points (L1–L5)',
    'Approximate — computed each frame from the two most massive bodies\' current separation and mass ratio; exact only for a circular restricted 3-body orbit.'
  ),
  new BooleanDisplayOption(
    'showForceField',
    'Force vector field',
    'Gravitational acceleration sampled on a grid in the z=0 plane, using the same force law and softening as the integrator.'
  ),
  new BooleanDisplayOption(
    'showBillboardArrows',
    'Billboard arrows',
    'Alternative to the force vector field above: the same sampled field rendered as camera-facing 2D arrow billboards instead of 3D cones.'
  ),
  new SelectDisplayOption(
    'arrowStyle',
    'Arrow style',
    'Canvas-drawn shape used for the billboard-arrows glyph.',
    { choices: ['chevron', 'skinny'] }
  ),
  new RangeDisplayOption(
    'forceFieldScale',
    'Field scale',
    'Magnitude-to-size mapping gamma (1x = true magnitude; >1x boosts weak/far-field arrows so they read stronger than the raw 1/r² falloff; <1x compresses them further toward invisible).',
    { min: 0.2, max: 3, step: 0.1 }
  ),
  new RangeDisplayOption(
    'forceFieldRadius',
    'Field radius',
    'Force-field "sphere of draw" — half-width of the sampled cube (AU).',
    { min: 2, max: 100, step: 1 }
  ),
  new RangeDisplayOption(
    'forceFieldCount',
    'Field count',
    'Force-field sample count (approximate total points; internally rounded to the nearest cube — grows fast).',
    { min: 8, max: 50000, step: 8 }
  ),
  new BooleanDisplayOption(
    'showFieldLines',
    'Field lines',
    'Gravitational field-line streamlines traced from seed points around each body, flowing toward the attracting mass.'
  ),
  new RangeDisplayOption(
    'fieldLinesRadius',
    'Field lines radius',
    'Field-lines "sphere of draw" — seed placement radius and max streamline travel distance (AU).',
    { min: 2, max: 100, step: 1 }
  ),
  new RangeDisplayOption(
    'fieldLinesCount',
    'Number of field lines',
    'Total seed count, distributed on a Fibonacci sphere around the bodies\' center of mass.',
    { min: 4, max: 500, step: 4 }
  ),
  new RangeDisplayOption(
    'fieldLinesScale',
    'Field lines scale',
    'Field-lines rendered length/arrow-spacing multiplier — mirrors the force field\'s scale slider.',
    { min: -0.5, max: 1.5, step: 0.1 }
  ),
];
