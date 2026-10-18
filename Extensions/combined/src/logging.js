let loggingDisabled = false;

export function setLoggingDisabled(value) {
  loggingDisabled = value;
}

export const logger = {
  log(...args) {
    if (!loggingDisabled) console.log(...args);
  },
  debug(...args) {
    if (!loggingDisabled) console.debug(...args);
  },
};
