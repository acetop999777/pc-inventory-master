function isRetryableStatus(status) {
  return status === 502 || status === 503 || status === 504;
}

module.exports = function errorHandler(err, req, res, next) {
  const status = Number(err?.status || err?.statusCode || 500) || 500;

  const code =
    (typeof err?.code === 'string' && err.code.trim()) ||
    (status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED');

  const message =
    (typeof err?.message === 'string' && err.message) ||
    (status === 500 ? 'Internal server error' : 'Request failed');

  const retryable =
    typeof err?.retryable === 'boolean' ? err.retryable : isRetryableStatus(status);

  // 服务端日志（不要把整个 err JSON stringify 以免循环引用）
  console.error('[error]', {
    requestId: req.requestId || null,
    status,
    code,
    message,
    path: req.originalUrl || req.url,
    method: req.method,
  });

  // 如果 headers 已经发出，交给 express 默认处理
  if (res.headersSent) return next(err);

  res.status(status).json({
    error: {
      code,
      message,
      retryable,
      requestId: req.requestId || null,
      // 可选细节：只在非生产/或你需要时再放开
      details: err?.details && typeof err.details === 'object' ? err.details : undefined,
    },
  });
};
