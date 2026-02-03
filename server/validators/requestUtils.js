const AppError = require('../errors/AppError');

/**
 * @param {unknown} v
 * @returns {string | null}
 */
function asNonEmptyString(v) {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/**
 * @param {unknown} v
 * @param {string} field
 * @returns {string}
 */
function requireNonEmptyString(v, field) {
  const s = asNonEmptyString(v);
  if (!s) {
    throw new AppError({
      code: 'INVALID_ARGUMENT',
      httpStatus: 400,
      retryable: false,
      message: `${field} is required`,
      details: { field },
    });
  }
  return s;
}

/**
 * @param {unknown} v
 * @param {string} field
 * @returns {number}
 */
function requireNumber(v, field) {
  const n = Number(v);
  if (!Number.isFinite(n)) {
    throw new AppError({
      code: 'INVALID_ARGUMENT',
      httpStatus: 400,
      retryable: false,
      message: `${field} must be a number`,
      details: { field },
    });
  }
  return n;
}

/**
 * @param {unknown} v
 * @param {string} field
 * @returns {number}
 */
function requireInt(v, field) {
  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new AppError({
      code: 'INVALID_ARGUMENT',
      httpStatus: 400,
      retryable: false,
      message: `${field} must be an integer`,
      details: { field },
    });
  }
  return n;
}

/**
 * @param {unknown} v
 * @param {string} field
 * @returns {Record<string, unknown>}
 */
function requireObject(v, field) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) {
    throw new AppError({
      code: 'INVALID_ARGUMENT',
      httpStatus: 400,
      retryable: false,
      message: `${field} must be an object`,
      details: { field },
    });
  }
  return /** @type {Record<string, unknown>} */ (v);
}

/**
 * @param {unknown} v
 * @param {string} field
 * @param {{ nonEmpty?: boolean }} [opts]
 * @returns {unknown[]}
 */
function requireArray(v, field, opts = {}) {
  if (!Array.isArray(v)) {
    throw new AppError({
      code: 'INVALID_ARGUMENT',
      httpStatus: 400,
      retryable: false,
      message: `${field} must be an array`,
      details: { field },
    });
  }
  if (opts.nonEmpty && v.length === 0) {
    throw new AppError({
      code: 'INVALID_ARGUMENT',
      httpStatus: 400,
      retryable: false,
      message: `${field} must be a non-empty array`,
      details: { field },
    });
  }
  return v;
}

/**
 * @param {unknown} v
 * @param {{ min?: number, max?: number, fallback?: number }} [opts]
 * @returns {number}
 */
function coerceLimit(v, opts = {}) {
  const min = Number.isFinite(opts.min) ? Number(opts.min) : 1;
  const max = Number.isFinite(opts.max) ? Number(opts.max) : 200;
  const fallback = Number.isFinite(opts.fallback) ? Number(opts.fallback) : 50;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min) return fallback;
  const safe = Math.floor(n);
  return Math.min(safe, max);
}

module.exports = {
  asNonEmptyString,
  requireNonEmptyString,
  requireNumber,
  requireInt,
  requireObject,
  requireArray,
  coerceLimit,
};
