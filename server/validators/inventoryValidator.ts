import { requireNonEmptyString, requireArray, requireObject } from './requestUtils';

/**
 * @param {unknown} body
 * @returns {{ operationId: string, items: unknown[] } & Record<string, unknown>}
 */
function assertInventoryBatchPayload(
  body: unknown,
): { operationId: string; items: unknown[] } & Record<string, unknown> {
  const payload = requireObject(body, 'body');
  const operationId = requireNonEmptyString(payload.operationId, 'operationId');
  const items = requireArray(payload.items, 'items');
  return { ...payload, operationId, items };
}

/**
 * @param {unknown} body
 * @returns {{ operationId: string } & Record<string, unknown>}
 */
function assertInventoryUpdatePayload(
  body: unknown,
): { operationId: string } & Record<string, unknown> {
  const payload = requireObject(body, 'body');
  const operationId = requireNonEmptyString(payload.operationId, 'operationId');
  return { ...payload, operationId };
}

export {
  assertInventoryBatchPayload,
  assertInventoryUpdatePayload,
};
