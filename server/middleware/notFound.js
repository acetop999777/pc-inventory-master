module.exports = function notFound(req, res, next) {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route not found: ${req.method} ${req.originalUrl || req.url}`,
      retryable: false,
      requestId: req.requestId || null,
    },
  });
};
