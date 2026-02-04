import type { Response, NextFunction } from 'express';
import type { RequestWithId } from './requestId';

function notFound(req: RequestWithId, res: Response, next: NextFunction) {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route not found: ${req.method} ${req.originalUrl || req.url}`,
      retryable: false,
      requestId: req.requestId || null,
    },
  });
}

export { notFound };
