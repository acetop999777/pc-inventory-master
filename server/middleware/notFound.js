/** @typedef {import('express').Request & { requestId?: string }} RequestWithId */

/**
 * @param {RequestWithId} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function notFound(req, res, next) {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route not found: ${req.method} ${req.originalUrl || req.url}`,
      retryable: false,
      requestId: req.requestId || null,
    },
  });
}

module.exports = notFound;
