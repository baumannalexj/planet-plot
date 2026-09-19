// Interface: a standard leveled logger — debug/info/warn/error, matching the
// shape of `console` and most logging libraries (loglevel, pino, winston),
// so swapping implementations never requires touching a call site.
//
// Own directory (src/api/logger/) rather than a flat file: this interface
// has multiple adapters worth distinguishing at a glance (console, loglevel,
// CSV file — see src/adapters/loggers/), same reasoning as
// PlotCorrectionStrategy's adapters living in their own subdirectory.
export class Logger {
  debug(...args) {
    throw new Error(`${this.constructor.name} must implement debug()`);
  }

  info(...args) {
    throw new Error(`${this.constructor.name} must implement info()`);
  }

  warn(...args) {
    throw new Error(`${this.constructor.name} must implement warn()`);
  }

  error(...args) {
    throw new Error(`${this.constructor.name} must implement error()`);
  }
}
