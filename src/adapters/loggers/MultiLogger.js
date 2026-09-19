// Fans a single Logger call out to multiple Logger implementations — e.g.
// console (for dev visibility) + CsvFileLogger (for tick-data capture) at
// the same time, without either adapter knowing the other exists.

import { Logger } from '@api/logger/Logger.js';

export class MultiLogger extends Logger {
  /** @param {Logger[]} loggers */
  constructor(loggers) {
    super();
    this.loggers = loggers;
  }

  debug(...args) {
    for (const l of this.loggers) l.debug(...args);
  }

  info(...args) {
    for (const l of this.loggers) l.info(...args);
  }

  warn(...args) {
    for (const l of this.loggers) l.warn(...args);
  }

  error(...args) {
    for (const l of this.loggers) l.error(...args);
  }
}
