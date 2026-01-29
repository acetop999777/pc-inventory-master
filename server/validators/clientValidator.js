const AppError = require('../errors/AppError');

function asNonEmptyString(v) {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function normalizeDateOnly(v) {
  if (!v) return null;
  if (typeof v !== 'string') return null;
  const s = v.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

function assertClientInput(c) {
  const fields = [];

  const id = asNonEmptyString(c.id);
  if (!id) fields.push({ field: 'id', message: 'id is required' });

  const wechatName = asNonEmptyString(c.wechatName);
  if (!wechatName) fields.push({ field: 'wechatName', message: 'wechatName is required' });

  const orderDate = normalizeDateOnly(c.orderDate);
  if (!orderDate) fields.push({ field: 'orderDate', message: 'orderDate is required and must be YYYY-MM-DD' });

  const deliveryDate = c.deliveryDate ? normalizeDateOnly(c.deliveryDate) : null;
  if (c.deliveryDate && !deliveryDate) fields.push({ field: 'deliveryDate', message: 'deliveryDate must be YYYY-MM-DD' });

  const numeric = ['totalPrice', 'actualCost', 'profit', 'paidAmount', 'rating'];
  for (const k of numeric) {
    if (c[k] === undefined || c[k] === null || c[k] === '') continue;
    const n = Number(c[k]);
    if (!Number.isFinite(n)) fields.push({ field: k, message: `${k} must be a number` });
  }

  if (fields.length > 0) {
    throw new AppError({
      code: 'INVALID_ARGUMENT',
      httpStatus: 400,
      retryable: false,
      message: 'Validation failed',
      details: { fields },
    });
  }

  return { id, wechatName, orderDate, deliveryDate };
}

module.exports = {
  assertClientInput,
  normalizeDateOnly,
};
