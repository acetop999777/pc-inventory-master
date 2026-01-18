const AppError = require('./AppError');

/**
 * Map common Postgres errors into AppError so routes don't need to scatter try/catch.
 * Keep it minimal and high-signal (Phase 8.3): unique violation -> CONFLICT.
 *
 * @param {any} err
 * @returns {AppError | null}
 */
function mapPostgresError(err) {
  if (!err || typeof err !== 'object') return null;
  const code = typeof err.code === 'string' ? err.code : '';

  // https://www.postgresql.org/docs/current/errcodes-appendix.html
  // 23505 = unique_violation
  if (code === '23505') {
    const detail = typeof err.detail === 'string' ? err.detail : '';
    let field = undefined;
    let value = undefined;
    const m = detail.match(/Key \(([^)]+)\)=\(([^)]+)\) already exists/i);
    if (m) {
      field = m[1];
      value = m[2];
    }

    const constraint = typeof err.constraint === 'string' ? err.constraint : undefined;
    const isSku =
      constraint === 'ux_inventory_sku_norm_nonempty' ||
      (typeof field === 'string' && field.toLowerCase().includes('sku'));

    return new AppError({
      code: 'CONFLICT',
      httpStatus: 409,
      retryable: false,
      message: isSku ? 'SKU already exists (must be unique)' : 'Conflict: duplicate value',
      details: {
        kind: 'unique_violation',
        field,
        value,
        constraint,
        table: typeof err.table === 'string' ? err.table : undefined,
      },
    });
  }

  // 23514 = check_violation
  if (code === '23514') {
    const constraint = typeof err.constraint === 'string' ? err.constraint : undefined;
    const table = typeof err.table === 'string' ? err.table : undefined;
    const detail = typeof err.detail === 'string' ? err.detail : undefined;
    const message = typeof err.message === 'string' ? err.message : 'Validation failed';

    return new AppError({
      code: 'VALIDATION_FAILED',
      httpStatus: 400,
      retryable: false,
      message: 'Validation failed',
      details: {
        kind: 'check_violation',
        constraint,
        table,
        detail,
        dbMessage: message,
      },
    });
  }

  return null;
}

module.exports = { mapPostgresError };
