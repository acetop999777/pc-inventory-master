const { mapPostgresError } = require('../errors/pg');

function isRetryableStatus(status) {
  return status === 502 || status === 503 || status === 504;
}

function inferCodeFromStatus(status) {
  if (status === 400) return 'INVALID_ARGUMENT';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status === 503) return 'DB_UNAVAILABLE';
  if (status === 504) return 'TIMEOUT';
  return 'INTERNAL';
}

module.exports = function errorHandler(err, req, res, next) {
  // 1) 尝试把常见 PG 错误收口成业务 code
  const mapped = mapPostgresError(err);
  const e = mapped || err;

  // 2) 统一读 status：兼容 AppError.httpStatus / express err.status
  const status = Number(e?.httpStatus || e?.status || e?.statusCode || 500) || 500;

  const code = (typeof e?.code === 'string' && e.code.trim()) || inferCodeFromStatus(status);

  const message =
    (typeof e?.message === 'string' && e.message) ||
    (status >= 500 ? 'Internal server error' : 'Request failed');

  const retryable =
    typeof e?.retryable === 'boolean' ? e.retryable : isRetryableStatus(status);

  // 服务端日志（不要把整个 err JSON stringify 以免循环引用）
  console.error('[error]', {
    requestId: req.requestId || null,
    operationId: req?.body?.operationId || null,
    status,
    code,
    message,
    path: req.originalUrl || req.url,
    method: req.method,
  });

  // 如果 headers 已经发出，交给 express 默认处理
  if (res.headersSent) return next(e);

  const payload = {
    error: {
      code,
      message,
      retryable,
      requestId: req.requestId || null,
    },
  };

  // 可选细节：只透出 object（避免把 Error/函数等奇怪东西塞给前端）
  if (e?.details && typeof e.details === 'object') {
    payload.error.details = e.details;
  }
  if (typeof e?.retryAfterMs === 'number') {
    payload.error.retryAfterMs = e.retryAfterMs;
  }

  res.status(status).json(payload);
};
