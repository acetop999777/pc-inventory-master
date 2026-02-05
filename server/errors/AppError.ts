type AppErrorOptions = {
  code: string;
  message: string;
  httpStatus?: number;
  details?: unknown;
  retryable?: boolean;
  retryAfterMs?: number;
};

class AppError extends Error {
  code: string;
  httpStatus: number;
  details?: unknown;
  retryable: boolean;
  retryAfterMs?: number;

  constructor({ code, message, httpStatus = 500, details, retryable, retryAfterMs }: AppErrorOptions) {
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

export = AppError;
