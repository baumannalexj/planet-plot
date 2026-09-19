// Logger backed by the `loglevel` npm package — the "real library" option.
// loglevel already has debug/info/warn/error methods with this exact shape,
// so this adapter is a thin pass-through; its value is centralizing level
// config (setLevel) and giving loglevel's persistence/plugin ecosystem a
// seam to plug into later without touching any call site.

import log from 'loglevel';
import { Logger } from '@api/logger/Logger.js';

export class LoglevelLogger extends Logger {
  /** @param {'trace'|'debug'|'info'|'warn'|'error'|'silent'} [level] */
  constructor(level = 'debug') {
    super();
    log.setLevel(level);
  }

  debug(...args) {
    log.debug(...args);
  }

  info(...args) {
    log.info(...args);
  }

  warn(...args) {
    log.warn(...args);
  }

  error(...args) {
    log.error(...args);
  }
}
