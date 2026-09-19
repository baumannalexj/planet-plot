import { ConsoleLogger } from '@adapters/loggers/ConsoleLogger.js';
import { CsvFileLogger } from '@adapters/loggers/CsvFileLogger.js';
import { LoglevelLogger } from '@adapters/loggers/LoglevelLogger.js';
import { MultiLogger } from '@adapters/loggers/MultiLogger.js';

/** Composition-root factory for @api/logger/Logger.js implementations. */
export class LoggerProvider {
  provideConsoleLogger(minLevel) {
    return new ConsoleLogger(minLevel);
  }

  provideCsvFileLogger() {
    return new CsvFileLogger();
  }

  provideLoglevelLogger(level) {
    return new LoglevelLogger(level);
  }

  provideMultiLogger(loggers) {
    return new MultiLogger(loggers);
  }
}

export const loggerProvider = new LoggerProvider();
