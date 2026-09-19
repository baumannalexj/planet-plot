// Physical constants and the simulation's unit system.
//
// The integrator runs in DIMENSIONLESS units with G = 1 (see Simulation.js).
// This file is the single place that maps those dimensionless units back to
// real-world physical quantities, so the UI can display meaningful numbers
// (e.g. elapsed time in days) without the physics core caring about SI units.
//
// Everything here is tunable — change UNIT_MASS_KG or UNIT_LENGTH_M to re-scale
// what "1 mass unit" or "1 length unit" means, and the derived time unit
// updates automatically to keep G = 1 self-consistent.
//
// Values themselves live in constants.json (loaded via Config) so they can
// be edited without touching this derivation logic.

import { config } from './Config.js';

// --- Real-world physical constants (SI) -------------------------------------

/** Newtonian gravitational constant, m^3 kg^-1 s^-2. */
export const G_REAL = config.gReal;

/** Mass of the Sun, kg. Our simulation's mass unit: m = 1  ==  1 solar mass. */
export const SOLAR_MASS_KG = config.solarMassKg;

/** Astronomical unit, metres. Our simulation's length unit: L = 1  ==  1 AU. */
export const AU_M = config.auM;

/** Seconds in a day / Julian year, for human-readable time output. */
export const SECONDS_PER_DAY = config.secondsPerDay;
export const DAYS_PER_YEAR = config.daysPerYear;

// --- Chosen simulation unit system ------------------------------------------
//
// unitMassSolar/unitLengthAu are user-editable magnitude modifiers (default 1)
// on top of the solar-mass/AU base units — e.g. modifier=5 on unit length
// means "1 simulation length unit = 5 AU". Read live from config on every
// call (not cached at import) so an in-UI edit takes effect immediately.

/** 1 simulation mass unit, in kg (default: one solar mass). */
export function getUnitMassKg() {
  return SOLAR_MASS_KG * config.unitMassSolar;
}

/** 1 simulation length unit, in metres (default: one AU). */
export function getUnitLengthM() {
  return AU_M * config.unitLengthAu;
}

/**
 * 1 simulation time unit, in seconds.
 *
 * The integrator uses G = 1. Physically G has units m^3 kg^-1 s^-2, so fixing
 * the mass and length units forces the time unit:
 *
 *     G_real * UNIT_MASS * UNIT_TIME^2 / UNIT_LENGTH^3 = 1
 *  => UNIT_TIME = sqrt( UNIT_LENGTH^3 / (G_real * UNIT_MASS) )
 *
 * With 1 AU + 1 solar mass this is ~5.0227e6 s ≈ 58.13 days — which correctly
 * makes a circular 1 AU orbit's period 2*pi time units = 1 year.
 */
export function getUnitTimeSec() {
  return Math.sqrt(getUnitLengthM() ** 3 / (G_REAL * getUnitMassKg()));
}

export function getUnitTimeDays() {
  return getUnitTimeSec() / SECONDS_PER_DAY;
}

// --- Conversion helpers ------------------------------------------------------

/** Convert dimensionless simulation time to elapsed days. */
export function simTimeToDays(simTime) {
  return simTime * getUnitTimeDays();
}

/** Convert dimensionless simulation time to elapsed years. */
export function simTimeToYears(simTime) {
  return simTimeToDays(simTime) / DAYS_PER_YEAR;
}

/** Convert a simulation mass to solar masses (identity while UNIT_MASS = M_sun). */
export function simMassToSolar(simMass) {
  return (simMass * getUnitMassKg()) / SOLAR_MASS_KG;
}

// --- Force-law regularization ------------------------------------------------

/**
 * Plummer softening length ε, in simulation length units (1 = 1 AU).
 * Regularizes the 1/r^2 singularity for close encounters:
 *   a = -G m r⃗ / (r² + ε²)^(3/2)
 * Chosen as ~0.03-0.1% of the smallest body separation across the shipped
 * presets (closest approach ~1 unit in the figure-8 preset) — small enough
 * to leave real orbits numerically unaffected, large enough that fixed-dt
 * RK4 (dt=0.01) stays stable through close encounters.
 *
 * Do NOT set this close to machine epsilon (~1e-16) or smaller: SOFTENING
 * is squared and added to r², and float64 has ~2.22e-16 relative precision,
 * so any ε with ε² ≲ 2.22e-16 * r² vanishes in the sum and the singularity
 * comes back. For r² ~ O(1) that floor is ε ≳ ~1.5e-8 — this value must
 * stay comfortably above it.
 */
export const SOFTENING = config.softening;
