const { requireNonEmptyString, requireArray, requireObject } = require('./requestUtils');

/**
 * @param {unknown} body
 * @returns {{ operationId: string, items: unknown[] } & Record<string, unknown>}
 */
function assertInventoryBatchPayload(body) {
  const payload = requireObject(body, 'body');
  const operationId = requireNonEmptyString(payload.operationId, 'operationId');
  const items = requireArray(payload.items, 'items');
  return { ...payload, operationId, items };
}

/**
 * @param {unknown} body
 * @returns {{ operationId: string } & Record<string, unknown>}
 */
function assertInventoryUpdatePayload(body) {
  const payload = requireObject(body, 'body');
  const operationId = requireNonEmptyString(payload.operationId, 'operationId');
  return { ...payload, operationId };
}

module.exports = {
  assertInventoryBatchPayload,
  assertInventoryUpdatePayload,
};
