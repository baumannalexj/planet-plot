// CSV file logger — implements @api/logger/Logger.js. Sends plain CSV text
// to the dev-server-only /__sim-log endpoint (see vite.config.js), which
// appends it to log/<session-timestamp>-data-output.csv. Browser JS can't
// touch the filesystem, hence the round trip through the dev server.
//
// Sim-tick model data is logged via debug(snapshot) — Simulation.emit()
// calls this every tick (see core/Simulation.js). info/warn/error are
// intentionally no-ops here: mixing free-text log lines into a CSV would
// corrupt its schema, and this adapter's only job is the tick-data export.
//
// Always logs bodies relative to the CENTER OF MASS
// (snapshot.relativeBodies('com')), regardless of whatever origin the UI
// happens to have selected — this is test-data generation, not a UI-
// following view, so it needs a fixed reference frame to be comparable run
// to run.
//
// Columns: every axis of every coordinate system (COORD_SYSTEMS) plus every
// coordinate-independent derived metric (DERIVED_METRICS) — i.e. every value
// that's plottable in the UI.

import { Logger } from '@api/logger/Logger.js';
import { COORD_SYSTEMS } from '@core/coordinates.js';
import { DERIVED_METRICS } from '@plots/metrics.js';

const LOG_ENDPOINT = '/__sim-log';

function csvEscape(value) {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export class CsvFileLogger extends Logger {
  constructor() {
    super();
    this._headerSent = false;
    this._columns = [
      'simTime',
      'body',
      ...Object.values(COORD_SYSTEMS).flatMap((sys) => sys.axes.map((axis) => `${sys.id}_${axis.id}`)),
      ...DERIVED_METRICS.filter((m) => m.id !== 'time').map((m) => m.id),
    ];
  }

  /** @param {object} snapshot  A Snapshot — see core/Simulation.js. */
  debug(snapshot) {
    const bodies = snapshot.relativeBodies('com');
    const rows = bodies.map((body) => {
      const values = { simTime: snapshot.time, body: body.name };
      for (const sys of Object.values(COORD_SYSTEMS)) {
        const components = sys.convert(body.position);
        for (const axis of sys.axes) values[`${sys.id}_${axis.id}`] = components[axis.id];
      }
      for (const metric of DERIVED_METRICS) {
        if (metric.id === 'time') continue;
        values[metric.id] = metric.compute(body, snapshot);
      }
      return this._columns.map((c) => csvEscape(values[c])).join(',');
    });

    const header = this._headerSent ? '' : `${this._columns.join(',')}\n`;
    this._headerSent = true;
    const payload = header + rows.join('\n') + '\n';

    // Fire-and-forget: logging must never block or crash the sim loop.
    fetch(LOG_ENDPOINT, { method: 'POST', body: payload }).catch(() => {});
  }

  info() {}
  warn() {}
  error() {}
}
