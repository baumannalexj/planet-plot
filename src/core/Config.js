// Loads constants.json (value + unit per entry) into known fields — no
// string-keyed dictionary lookups at call sites. constants.js reads
// config.gReal, config.solarMassKg, etc. directly; adding a new constant
// means adding a field here, not just a JSON entry.
import raw from './constants.json';

export class Config {
  constructor(entries) {
    this.gReal = entries.G_REAL.value;
    this.solarMassKg = entries.SOLAR_MASS_KG.value;
    this.auM = entries.AU_M.value;
    this.secondsPerDay = entries.SECONDS_PER_DAY.value;
    this.daysPerYear = entries.DAYS_PER_YEAR.value;
    this.unitMassSolar = entries.UNIT_MASS_SOLAR.value;
    this.unitLengthAu = entries.UNIT_LENGTH_AU.value;
    this.softening = entries.SOFTENING.value;

    this.units = {
      gReal: entries.G_REAL.unit,
      solarMassKg: entries.SOLAR_MASS_KG.unit,
      auM: entries.AU_M.unit,
      secondsPerDay: entries.SECONDS_PER_DAY.unit,
      daysPerYear: entries.DAYS_PER_YEAR.unit,
      unitMassSolar: entries.UNIT_MASS_SOLAR.unit,
      unitLengthAu: entries.UNIT_LENGTH_AU.unit,
      softening: entries.SOFTENING.unit,
    };

    // For the UI listing only (Config.list) — consumers needing a specific
    // constant still read the named field above, not this array. A GETTER,
    // not a snapshot array: fields are directly mutable (config.softening =
    // x works today, plain instance property) — for an editable-in-UI list
    // to ever show the new value, this has to rebuild from current field
    // values on every access, not freeze them at construction time.
    Object.defineProperty(this, 'list', {
      get() {
        return [
          { key: 'gReal', label: 'G (real)', value: this.gReal, unit: this.units.gReal },
          { key: 'solarMassKg', label: 'Solar mass', value: this.solarMassKg, unit: this.units.solarMassKg },
          { key: 'auM', label: 'Astronomical unit', value: this.auM, unit: this.units.auM },
          { key: 'secondsPerDay', label: 'Seconds per day', value: this.secondsPerDay, unit: this.units.secondsPerDay },
          { key: 'daysPerYear', label: 'Days per year', value: this.daysPerYear, unit: this.units.daysPerYear },
          { key: 'unitMassSolar', label: 'Unit mass', value: this.unitMassSolar, unit: this.units.unitMassSolar },
          { key: 'unitLengthAu', label: 'Unit length', value: this.unitLengthAu, unit: this.units.unitLengthAu },
          { key: 'softening', label: 'Softening (ε)', value: this.softening, unit: this.units.softening },
        ];
      },
    });
  }
}

export const config = new Config(raw);
