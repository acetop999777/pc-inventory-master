const { requireNonEmptyString, requireArray, requireObject, coerceLimit } = require('./requestUtils');
const AppError = require('../errors/AppError');

/**
 * @param {unknown} limit
 * @returns {number}
 */
function normalizeReceiptListLimit(limit) {
  return coerceLimit(limit, { min: 1, max: 200, fallback: 50 });
}

/**
 * @param {unknown} v
 * @returns {string | number | Date | null | undefined}
 */
function normalizeReceiptDateInput(v) {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'string' || typeof v === 'number') return v;
  return null;
}

/**
 * @param {unknown} body
 * @returns {{
 *   operationId: string,
 *   items: unknown[],
 *   receivedAt?: string | number | Date | null,
 *   vendor?: unknown,
 *   mode?: unknown,
 *   notes?: unknown,
 *   images?: unknown
 * } & Record<string, unknown>}
 */
function assertReceiptCreatePayload(body) {
  const payload = requireObject(body, 'body');
  const operationId = requireNonEmptyString(payload.operationId, 'operationId');
  const items = requireArray(payload.items, 'items', { nonEmpty: true });
  const receivedAt = normalizeReceiptDateInput(payload.receivedAt);
  return { ...payload, operationId, items, receivedAt };
}

/**
 * @param {unknown} body
 * @returns {Record<string, unknown>}
 */
function assertReceiptUpdatePayload(body) {
  const payload = requireObject(body, 'body');
  if (Object.prototype.hasOwnProperty.call(payload, 'items') && !Array.isArray(payload.items)) {
    throw new AppError({
      code: 'INVALID_ARGUMENT',
      httpStatus: 400,
      retryable: false,
      message: 'items must be an array',
      details: { field: 'items' },
    });
  }
  return payload;
}

module.exports = {
  normalizeReceiptListLimit,
  assertReceiptCreatePayload,
  assertReceiptUpdatePayload,
};
