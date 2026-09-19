// Plain console-backed Logger. No dependency — this is the "standard
// practice, no library needed" option; swap for LoglevelLogger if you need
// more (remote transport, persistent level across reloads, etc.).

import { Logger } from '@api/logger/Logger.js';

const LEVEL_RANK = { debug: 0, info: 1, warn: 2, error: 3 };

export class ConsoleLogger extends Logger {
  /** @param {'debug'|'info'|'warn'|'error'} [minLevel] Calls below this rank are dropped. */
  constructor(minLevel = 'debug') {
    super();
    this.minLevel = minLevel;
  }

  _allowed(level) {
    return LEVEL_RANK[level] >= LEVEL_RANK[this.minLevel];
  }

  debug(...args) {
    if (this._allowed('debug')) console.debug(...args);
  }

  info(...args) {
    if (this._allowed('info')) console.info(...args);
  }

  warn(...args) {
    if (this._allowed('warn')) console.warn(...args);
  }

  error(...args) {
    if (this._allowed('error')) console.error(...args);
  }
}
