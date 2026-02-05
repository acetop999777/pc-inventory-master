import AppError = require('./AppError');

const DB_UNAVAILABLE_CODES = new Set([
  '57P01', // admin_shutdown
  '57P02', // crash_shutdown
  '57P03', // cannot_connect_now
  '08001', // sqlclient_unable_to_establish_sqlconnection
  '08003', // connection_does_not_exist
  '08004', // sqlserver_rejected_establishment
  '08006', // connection_failure
  '08007', // transaction_resolution_unknown
  '08P01', // protocol_violation
  '53300', // too_many_connections
  'ECONNREFUSED',
  'ECONNRESET',
  'EPIPE',
  'ENETUNREACH',
]);

/**
 * Map common Postgres errors into AppError so routes don't need to scatter try/catch.
 * Keep it minimal and high-signal.
 */
function mapPostgresError(err: unknown): AppError | null {
  if (!err || typeof err !== 'object') return null;
  const errObj = err as {
    code?: unknown;
    message?: unknown;
    detail?: unknown;
    constraint?: unknown;
    table?: unknown;
  };
  const code = typeof errObj.code === 'string' ? errObj.code : '';

  if (DB_UNAVAILABLE_CODES.has(code)) {
    return new AppError({
      code: 'DB_UNAVAILABLE',
      httpStatus: 503,
      retryable: true,
      message: 'Database unavailable',
      details: { dbCode: code },
    });
  }

  // 57014 = query_canceled (often timeout)
  if (code === '57014' || (typeof errObj.message === 'string' && errObj.message.includes('timeout'))) {
    return new AppError({
      code: 'TIMEOUT',
      httpStatus: 504,
      retryable: true,
      message: 'Database timeout',
      details: { dbCode: code },
    });
  }

  // https://www.postgresql.org/docs/current/errcodes-appendix.html
  // 23505 = unique_violation
  if (code === '23505') {
    const detail = typeof errObj.detail === 'string' ? errObj.detail : '';
    let field = undefined;
    let value = undefined;
    const m = detail.match(/Key \(([^)]+)\)=\(([^)]+)\) already exists/i);
    if (m) {
      field = m[1];
      value = m[2];
    }

    const constraint = typeof errObj.constraint === 'string' ? errObj.constraint : undefined;
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
        table: typeof errObj.table === 'string' ? errObj.table : undefined,
      },
    });
  }

  // 23514 = check_violation
  if (code === '23514') {
    const constraint = typeof errObj.constraint === 'string' ? errObj.constraint : undefined;
    const table = typeof errObj.table === 'string' ? errObj.table : undefined;
    const detail = typeof errObj.detail === 'string' ? errObj.detail : undefined;
    const message = typeof errObj.message === 'string' ? errObj.message : 'Validation failed';

    return new AppError({
      code: 'INVALID_ARGUMENT',
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

  // 23503 = foreign_key_violation
  if (code === '23503') {
    const constraint = typeof errObj.constraint === 'string' ? errObj.constraint : undefined;
    const table = typeof errObj.table === 'string' ? errObj.table : undefined;
    const detail = typeof errObj.detail === 'string' ? errObj.detail : undefined;
    const message = typeof errObj.message === 'string' ? errObj.message : 'Foreign key violation';

    return new AppError({
      code: 'CONFLICT',
      httpStatus: 409,
      retryable: false,
      message: 'Record is referenced by other data',
      details: {
        kind: 'foreign_key_violation',
        constraint,
        table,
        detail,
        dbMessage: message,
      },
    });
  }

  return null;
}

export { mapPostgresError };
