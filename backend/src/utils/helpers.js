/**
 * @fileoverview General-purpose utility functions used across the application.
 * All helpers are pure functions with no side effects unless documented otherwise.
 */

import { v4 as uuidv4 } from 'uuid';

// ── Environment Helpers ───────────────────────────────────────────────────────

/**
 * Returns true if running in production mode.
 * @returns {boolean}
 */
export const isProduction = () => process.env.NODE_ENV === 'production';

/**
 * Returns true if running in development mode.
 * @returns {boolean}
 */
export const isDevelopment = () => process.env.NODE_ENV === 'development';

/**
 * Returns true if running in test mode.
 * @returns {boolean}
 */
export const isTest = () => process.env.NODE_ENV === 'test';

// ── Identifier Helpers ────────────────────────────────────────────────────────

/**
 * Generates a new UUID v4 string.
 * @returns {string}
 */
export const generateId = () => uuidv4();

/**
 * Generates a short alphanumeric reference ID (8 chars).
 * Suitable for human-readable incident or alert IDs.
 * @returns {string}
 */
export const generateShortId = () => Math.random().toString(36).substring(2, 10).toUpperCase();

// ── Object Helpers ────────────────────────────────────────────────────────────

/**
 * Returns a shallow copy of `obj` with the specified keys removed.
 * @template {object} T
 * @param {T} obj - Source object
 * @param {(keyof T)[]} keys - Keys to exclude
 * @returns {Partial<T>}
 */
export const omitKeys = (obj, keys) => {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result;
};

/**
 * Returns a shallow copy of `obj` containing only the specified keys.
 * @template {object} T
 * @param {T} obj - Source object
 * @param {(keyof T)[]} keys - Keys to include
 * @returns {Partial<T>}
 */
export const pickKeys = (obj, keys) => {
  return keys.reduce((acc, key) => {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      acc[key] = obj[key];
    }
    return acc;
  }, {});
};

/**
 * Recursively deep-freezes an object and all nested objects.
 * @template T
 * @param {T} obj
 * @returns {Readonly<T>}
 */
export const deepFreeze = (obj) => {
  Object.freeze(obj);
  Object.getOwnPropertyNames(obj).forEach((name) => {
    const value = obj[name];
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  });
  return obj;
};

/**
 * Returns a Mongoose-safe projection object that strips __v by default.
 * @param {object} [projection={}] - Additional projection fields
 * @returns {object}
 */
export const safeProjection = (projection = {}) => ({
  __v: 0,
  ...projection,
});

// ── String Helpers ────────────────────────────────────────────────────────────

/**
 * Capitalizes the first letter of a string and lowercases the rest.
 * @param {string} str
 * @returns {string}
 */
export const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();

/**
 * Converts a camelCase string to snake_case.
 * @param {string} str
 * @returns {string}
 */
export const toSnakeCase = (str) => str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

/**
 * Truncates a string to `maxLength` characters, appending `...` if truncated.
 * @param {string} str
 * @param {number} [maxLength=100]
 * @returns {string}
 */
export const truncate = (str, maxLength = 100) =>
  str.length > maxLength ? `${str.slice(0, maxLength)}...` : str;

// ── Time Helpers ──────────────────────────────────────────────────────────────

/**
 * Returns a Promise that resolves after `ms` milliseconds.
 * Use for retry delays — never use in hot paths.
 * @param {number} ms - Duration in milliseconds
 * @returns {Promise<void>}
 */
export const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Converts process uptime in seconds to a human-readable duration string.
 * @param {number} totalSeconds - Seconds of uptime
 * @returns {string} e.g. "2d 4h 30m 15s"
 */
export const formatUptime = (totalSeconds) => {
  const d = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);

  return [d > 0 && `${d}d`, h > 0 && `${h}h`, m > 0 && `${m}m`, `${s}s`].filter(Boolean).join(' ');
};

/**
 * Converts milliseconds to a human-readable duration string.
 * @param {number} ms
 * @returns {string}
 */
export const msToHuman = (ms) => formatUptime(Math.floor(ms / 1000));

// ── Number Helpers ────────────────────────────────────────────────────────────

/**
 * Clamps a number between a minimum and maximum value.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

/**
 * Rounds a number to the specified number of decimal places.
 * @param {number} value
 * @param {number} [decimals=2]
 * @returns {number}
 */
export const roundTo = (value, decimals = 2) => Math.round(value * 10 ** decimals) / 10 ** decimals;

// ── Validation Helpers ────────────────────────────────────────────────────────

/**
 * Returns true if the value is a non-empty string.
 * @param {unknown} value
 * @returns {boolean}
 */
export const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

/**
 * Returns true if the value is a positive integer.
 * @param {unknown} value
 * @returns {boolean}
 */
export const isPositiveInt = (value) => Number.isInteger(value) && value > 0;

/**
 * Parses a page/limit query string parameter into a safe integer.
 * @param {unknown} value - Raw query param value
 * @param {number} defaultValue - Fallback value
 * @param {number} [max=100] - Maximum allowed value
 * @returns {number}
 */
export const parseQueryInt = (value, defaultValue, max = 100) => {
  const parsed = parseInt(String(value), 10);
  if (isNaN(parsed) || parsed < 1) {
    return defaultValue;
  }
  return Math.min(parsed, max);
};
