const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

let currentLevel = process.env.LOG_LEVEL || 'info';

function shouldLog(level) {
  return LEVELS[level] <= LEVELS[currentLevel];
}

function log(level, args, opts = {}) {
  if (opts.phi && process.env.LOG_PHI !== 'true') {
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

const logger = {
  setLevel(level) {
    if (LEVELS[level] !== undefined) {
      currentLevel = level;
    }
  },
  error(...args) {
    log('error', args);
  },
  warn(...args) {
    log('warn', args);
  },
  info(...args) {
    log('info', args);
  },
  debug(...args) {
    log('debug', args);
  },
};

export default logger;
