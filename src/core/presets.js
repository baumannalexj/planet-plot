import { Body } from './Body.js';

// A small jitter so "the same" preset is never bit-identical run to run, while
// staying close to the known semi-stable configuration.
function jitter(scale = 0.01) {
  return (Math.random() * 2 - 1) * scale;
}

function j3(scale) {
  return [jitter(scale), jitter(scale), jitter(scale)];
}

function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

/**
 * Preset orbital configurations. Each returns a fresh array of Body instances.
 * Positions/velocities are tuned for G = 1 (see Simulation.G).
 */
export const PRESETS = {
  'one-body': {
    label: 'One body (orbiting a star)',
    build() {
      // Heavy central star + one planet on a near-circular orbit.
      return [
        new Body({ name: 'Star', mass: 100, color: '#f6e05e', position: [0, 0, 0], velocity: [0, 0, 0] }),
        new Body({
          name: 'Planet',
          mass: 1,
          color: '#3182ce',
          position: add([4, 0, 0], j3(0.02)),
          velocity: add([0, 5, 0], j3(0.05)), // v ~ sqrt(G*M/r) = sqrt(100/4) = 5
        }),
      ];
    },
  },

  'two-body': {
    label: 'Two body (binary)',
    build() {
      // Equal-mass binary orbiting their common barycenter at the origin.
      const m = 10;
      return [
        new Body({ name: 'Alpha', mass: m, color: '#fc8181', position: add([-2, 0, 0], j3(0.02)), velocity: add([0, -1.118, 0], j3(0.03)) }),
        new Body({ name: 'Beta', mass: m, color: '#63b3ed', position: add([2, 0, 0], j3(0.02)), velocity: add([0, 1.118, 0], j3(0.03)) }),
      ];
    },
  },

  'three-body-planar': {
    label: 'Three body (figure-8, planar)',
    build() {
      // Chenciner–Montgomery figure-eight choreography (equal masses, G=1).
      // Unlike the other presets, this one deliberately omits jitter: the
      // figure-8 is a razor's-edge periodic orbit, chaotically sensitive to
      // initial conditions — even j3(0.005)-sized perturbations get amplified
      // by fixed-dt RK4 until two bodies have a close encounter and the whole
      // configuration disintegrates (observed empirically: ~40% of jittered
      // runs blow up with >1000x energy drift within a few hundred time
      // units). So this preset uses the exact canonical values with no
      // randomization.
      const m = 1;
      const p1 = [0.97000436, -0.24308753, 0];
      const v3 = [0.93240737, 0.86473146, 0];
      return [
        new Body({ name: 'A', mass: m, color: '#f6ad55', position: p1, velocity: [v3[0] / 2, v3[1] / 2, 0] }),
        new Body({ name: 'B', mass: m, color: '#4fd1c5', position: [-p1[0], -p1[1], 0], velocity: [v3[0] / 2, v3[1] / 2, 0] }),
        new Body({ name: 'C', mass: m, color: '#b794f4', position: [0, 0, 0], velocity: [-v3[0], -v3[1], 0] }),
      ];
    },
  },

  'three-body-nonplanar': {
    label: 'Three body (non-planar)',
    build() {
      // Sun-like center with two planets on inclined orbits — semi-stable,
      // clearly 3D. Jitter keeps each run slightly different.
      return [
        new Body({ name: 'Sun', mass: 80, color: '#f6e05e', position: [0, 0, 0], velocity: [0, 0, 0] }),
        new Body({
          name: 'Inner',
          mass: 1,
          color: '#68d391',
          position: add([3, 0, 0], j3(0.03)),
          velocity: add([0, 5.16, 0.4], j3(0.05)),
        }),
        new Body({
          name: 'Outer',
          mass: 2,
          color: '#f687b3',
          position: add([-6, 0, 1.5], j3(0.03)),
          velocity: add([0, -3.6, 0.6], j3(0.05)),
        }),
      ];
    },
  },

  'earth-moon-sun': {
    label: 'Earth, Moon & Sun',
    build() {
      // Sun-Earth-Moon hierarchy. Real Earth-Moon numbers (distance ~0.00257
      // AU, mass ratio ~81:1) sit right on top of SOFTENING (1e-3) and are
      // visually imperceptible at solar-system scale, so the Moon's distance
      // and mass are both exaggerated well above real life to keep its orbit
      // stable under fixed-dt RK4 and clearly visible. Earth's velocity is
      // computed first, then the Moon's velocity is Earth's velocity PLUS
      // the Moon's own orbital velocity around Earth, so it actually orbits
      // Earth instead of just trailing along beside it.
      const sunMass = 100;
      const earthMass = 0.8;
      const earthDist = 7;
      const earthPos = add([earthDist, 0, 0], j3(0.02));
      const earthSpeed = Math.sqrt(sunMass / earthDist); // v = sqrt(G*M/r)
      const earthVel = add([0, earthSpeed, 0], j3(0.02));

      const moonDist = 0.3; // ~300x SOFTENING — comfortably clear of it
      const moonSpeed = Math.sqrt(earthMass / moonDist); // orbital v around Earth
      const moonPos = add(earthPos, [moonDist, 0, 0]);
      const moonVel = add(earthVel, [0, moonSpeed, 0]);

      return [
        new Body({ name: 'Sun', mass: sunMass, color: '#f6e05e', position: [0, 0, 0], velocity: [0, 0, 0] }),
        new Body({ name: 'Earth', mass: earthMass, color: '#3182ce', position: earthPos, velocity: earthVel }),
        new Body({ name: 'Moon', mass: 0.02, color: '#cbd5e0', position: moonPos, velocity: moonVel }),
      ];
    },
  },

  'three-body-moon': {
    label: 'Three body + moon',
    build() {
      // Hierarchical 4-body system: a heavy central Star with two planets on
      // near-circular orbits (placed on perpendicular axes so their mutual
      // separation stays large and they don't perturb each other much), and
      // a Moon orbiting the outer planet (Planet B). As with the
      // earth-moon-sun preset, the Moon's velocity is Planet B's velocity
      // PLUS its own orbital velocity around Planet B, and its distance is
      // kept well above SOFTENING for stability.
      const starMass = 150;

      const planetADist = 5;
      const planetAMass = 2;
      const planetAPos = add([planetADist, 0, 0], j3(0.02));
      const planetASpeed = Math.sqrt(starMass / planetADist);
      const planetAVel = add([0, planetASpeed, 0], j3(0.02));

      const planetBDist = 10;
      const planetBMass = 3;
      const planetBPos = add([0, planetBDist, 0], j3(0.02));
      const planetBSpeed = Math.sqrt(starMass / planetBDist);
      // Prograde tangential direction for a body on the +y axis is -x.
      const planetBVel = add([-planetBSpeed, 0, 0], j3(0.02));

      const moonDist = 0.4; // ~400x SOFTENING
      const moonSpeed = Math.sqrt(planetBMass / moonDist);
      const moonPos = add(planetBPos, [moonDist, 0, 0]);
      const moonVel = add(planetBVel, [0, moonSpeed, 0]);

      return [
        new Body({ name: 'Star', mass: starMass, color: '#f6e05e', position: [0, 0, 0], velocity: [0, 0, 0] }),
        new Body({ name: 'Planet A', mass: planetAMass, color: '#68d391', position: planetAPos, velocity: planetAVel }),
        new Body({ name: 'Planet B', mass: planetBMass, color: '#f6ad55', position: planetBPos, velocity: planetBVel }),
        new Body({ name: 'Moon', mass: 0.03, color: '#b794f4', position: moonPos, velocity: moonVel }),
      ];
    },
  },
};

export const DEFAULT_PRESET = 'three-body-planar';
