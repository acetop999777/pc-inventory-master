const crypto = require('crypto');

/** @typedef {import('express').Request & { requestId?: string }} RequestWithId */

/**
 * @param {RequestWithId} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function requestId(req, res, next) {
  const incoming = req.get('x-request-id');
  const id =
    typeof incoming === 'string' && incoming.length > 0 && incoming.length <= 128
      ? incoming
      : crypto.randomUUID();

  req.requestId = id;
  res.setHeader('x-request-id', id);
  next();
}

module.exports = requestId;
