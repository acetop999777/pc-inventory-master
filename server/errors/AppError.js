class AppError extends Error {
  /**
   * @param {object} opts
   * @param {string} opts.code
   * @param {string} opts.message
   * @param {number} [opts.httpStatus=500]
   * @param {any} [opts.details]
   * @param {boolean} [opts.retryable]
   * @param {number} [opts.retryAfterMs]
   */
  constructor({ code, message, httpStatus = 500, details, retryable, retryAfterMs }) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
    // 默认策略：5xx 更可能“可重试”，4xx 通常不可重试
    this.retryable = typeof retryable === 'boolean' ? retryable : httpStatus >= 500;
    if (typeof retryAfterMs === 'number') this.retryAfterMs = retryAfterMs;
  }
}

module.exports = AppError;
