import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

export type RequestWithId = Request & { requestId?: string };

function requestId(req: RequestWithId, res: Response, next: NextFunction) {
  const incoming = req.get('x-request-id');
  const id =
    typeof incoming === 'string' && incoming.length > 0 && incoming.length <= 128
      ? incoming
      : crypto.randomUUID();

  req.requestId = id;
  res.setHeader('x-request-id', id);
  next();
}

export { requestId };
