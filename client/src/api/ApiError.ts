export type ApiErrorPayload = {
  error: {
    code: string;
    message: string;
    retryable?: boolean;
    requestId?: string | null;
    details?: unknown;
  };
};

export class ApiError extends Error {
  code: string;
  retryable: boolean;
  requestId: string | null;
  details: unknown;
  status: number;

  constructor(args: {
    code: string;
    message: string;
    status: number;
    retryable?: boolean;
    requestId?: string | null;
    details?: unknown;
  }) {
    super(args.message);
    this.name = 'ApiError';
    this.code = args.code;
    this.status = args.status;
    this.retryable = Boolean(args.retryable);
    this.requestId = args.requestId ?? null;
    this.details = args.details;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return typeof e === 'object' && e !== null && (e as any).name === 'ApiError';
}

export function extractUserMessage(e: unknown): string {
  if (isApiError(e)) {
    // 给用户的 message：优先 server message，附 requestId 便于排查
    return e.requestId ? `${e.message} (id: ${e.requestId})` : e.message;
  }
  if (e instanceof Error) return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}
