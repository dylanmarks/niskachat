export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

const LEVELS: Record<LogLevel, number> = { error: 0, warn: 1, info: 2, debug: 3 };

let currentLevel: LogLevel = 'info';
let logPHI = false;

export function setLogLevel(level: LogLevel): void {
  if (LEVELS[level] !== undefined) {
    currentLevel = level;
  }
}

export function enablePHILogging(enable = true): void {
  logPHI = enable;
}

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] <= LEVELS[currentLevel];
}

function log(level: LogLevel, args: unknown[]): void {
  let phi = false;
  const last = args[args.length - 1];
  if (typeof last === 'object' && last !== null && 'phi' in (last as any)) {
    phi = Boolean((last as any).phi);
    args = args.slice(0, -1);
  }

  if (phi && !logPHI) {
    return;
  }

  if (!shouldLog(level)) {
    return;
  }

  const method = level === 'error'
    ? console.error
    : level === 'warn'
      ? console.warn
      : level === 'debug'
        ? console.debug
        : console.log;

  method(...args);
}

export const logger = {
  setLevel: setLogLevel,
  enablePHILogging,
  error: (...args: unknown[]) => log('error', args),
  warn: (...args: unknown[]) => log('warn', args),
  info: (...args: unknown[]) => log('info', args),
  debug: (...args: unknown[]) => log('debug', args),
};
