export function sanitizeCount(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return 0;
  }
  return Math.trunc(number);
}

export function toEpoch(value) {
  if (!value) return null;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function capitalize(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "";
}

export function debounce(fn, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

export function createRetryTimer(callback, delay) {
  let timeoutId = null;
  return {
    schedule() {
      if (timeoutId !== null) return;
      timeoutId = setTimeout(() => {
        timeoutId = null;
        callback();
      }, delay);
    },
    cancel() {
      if (timeoutId === null) return;
      clearTimeout(timeoutId);
      timeoutId = null;
    },
  };
}

export function safeJson(response) {
  return response
    .clone()
    .json()
    .catch(() => null);
}
