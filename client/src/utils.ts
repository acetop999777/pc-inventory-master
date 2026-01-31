import { apiFetch } from './lib/api';

export const API_BASE = '/api';
export const generateId = (): string => Math.random().toString(36).substr(2, 9);
export const formatMoney = (n: number | undefined): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);
export const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const maxDim = 800;
        let w = img.width,
          h = img.height;
        if (w > h && w > maxDim) {
          h *= maxDim / w;
          w = maxDim;
        } else if (h > maxDim) {
          w *= maxDim / h;
          h = maxDim;
        }
        canvas.width = w;
        canvas.height = h;
        ctx?.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
    };
  });
};

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type ApiErrorKind = 'NETWORK' | 'TIMEOUT' | 'HTTP' | 'PARSE' | 'UNKNOWN';
export type ErrorContract = {
  error: {
    code: string;
    message: string;
    details?: unknown;
    retryable?: boolean;
    retryAfterMs?: number;
    requestId?: string;
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

function extractErrorContract(
  body: unknown,
  headerRequestId?: string | null,
): ErrorContract['error'] | null {
  const bodyObj = isRecord(body) ? body : null;
  const errorValue = bodyObj ? bodyObj.error : null;
  const e = isRecord(errorValue) ? errorValue : null;
  if (!e) return null;

  const code = typeof e.code === 'string' && e.code ? e.code : 'HTTP_ERROR';
  const message =
    typeof e.message === 'string' && e.message
      ? e.message
      : typeof bodyObj?.message === 'string'
        ? bodyObj.message
        : 'Request failed';

  const requestId =
    typeof e.requestId === 'string' && e.requestId
      ? e.requestId
      : typeof headerRequestId === 'string' && headerRequestId
        ? headerRequestId
        : undefined;

  const details = e.details;
  const retryable = typeof e.retryable === 'boolean' ? e.retryable : undefined;
  const retryAfterMs = typeof e.retryAfterMs === 'number' ? e.retryAfterMs : undefined;

  return { code, message, details, retryable, retryAfterMs, requestId };
}

type ApiCallErrorInit = {
  message: string;
  url: string;
  method: HttpMethod;
  kind: ApiErrorKind;
  status?: number;
  responseBody?: unknown;

  // contract
  code?: string;
  requestId?: string;
  details?: unknown;
  retryable?: boolean;
  retryAfterMs?: number;

  // back-compat
  retriable?: boolean;

  userMessage: string;
};

export class ApiCallError extends Error {
  url: string;
  method: HttpMethod;
  kind: ApiErrorKind;
  status?: number;
  responseBody?: unknown;

  // Contract-aligned fields (from server {error:{...}})
  code?: string;
  requestId?: string;
  details?: unknown;
  retryAfterMs?: number;

  // Back-compat: existing code uses `.retriable`
  retriable: boolean;
  // Preferred name (alias)
  retryable: boolean;

  userMessage: string;

  // Back-compat signature (旧代码可能还在用 new ApiCallError(msg, url, status, body))
  constructor(message: string, url: string, status?: number, responseBody?: unknown);
  // New structured signature
  constructor(init: ApiCallErrorInit);
  constructor(a: string | ApiCallErrorInit, b?: string, c?: number, d?: unknown) {
    const legacy = typeof a === 'string';
    const init: ApiCallErrorInit = legacy
      ? {
          message: a as string,
          url: b as string,
          method: 'GET' as HttpMethod,
          kind: 'HTTP' as ApiErrorKind,
          status: c as number | undefined,
          responseBody: d as unknown,

          code: undefined,
          requestId: undefined,
          details: undefined,
          retryable: true,
          retryAfterMs: undefined,

          retriable: true,
          userMessage:
            typeof d === 'string' && d
              ? d.slice(0, 240)
              : c
                ? `Request failed (${c})`
                : 'Request failed',
        }
      : (a as ApiCallErrorInit);

    const retryable =
      typeof init.retryable === 'boolean'
        ? init.retryable
        : typeof init.retriable === 'boolean'
          ? init.retriable
          : true;

    super(init.message);
    this.name = 'ApiCallError';
    this.url = init.url;
    this.method = init.method;
    this.kind = init.kind;
    this.status = init.status;
    this.responseBody = init.responseBody;

    this.code = init.code;
    this.requestId = init.requestId;
    this.details = init.details;
    this.retryAfterMs = init.retryAfterMs;

    this.retriable = retryable;
    this.retryable = retryable;

    this.userMessage = init.userMessage;
  }
}

async function parseResponseBody(res: Response): Promise<unknown> {
  const ct = res.headers.get('content-type') || '';
  try {
    if (res.status === 204) return null;
    if (ct.includes('application/json')) return await res.json();
    return await res.text();
  } catch {
    return null;
  }
}

function guessRetriableFromStatus(status?: number): boolean {
  if (!status) return true;
  if (status === 408 || status === 429) return true;
  if (status >= 500) return true;
  if (status === 409) return true;
  return false;
}

function extractUserMessage(kind: ApiErrorKind, status: number | undefined, body: unknown): string {
  const bodyObj = isRecord(body) ? body : null;
  const errorValue = bodyObj ? bodyObj.error : null;
  const err = isRecord(errorValue) ? errorValue : null;
  const code = typeof err?.code === 'string' ? err.code : undefined;

  // Prefer first field message for validation failures (better UX even before inline errors land)
  if (code === 'VALIDATION_FAILED' || code === 'INVALID_ARGUMENT') {
    const detailsValue = err ? err.details : null;
    const details = isRecord(detailsValue) ? detailsValue : null;
    const fieldsValue = details ? details.fields : null;
    const fields = Array.isArray(fieldsValue) ? fieldsValue : null;
    if (Array.isArray(fields) && fields.length > 0) {
      const msg = fields[0]?.message;
      if (typeof msg === 'string' && msg) return msg.slice(0, 240);
    }
  }

  const m =
    typeof err?.message === 'string' && err.message
      ? err.message
      : typeof bodyObj?.message === 'string' && bodyObj.message
        ? bodyObj.message
        : typeof body === 'string'
          ? body
          : null;

  if (m && typeof m === 'string') return m.slice(0, 240);

  if (kind === 'TIMEOUT') return 'Request timed out';
  if (kind === 'NETWORK') return 'Network error (server unreachable)';
  if (kind === 'HTTP') return status ? `Request failed (${status})` : 'Request failed';
  return 'Request failed';
}

/**
 * Strict API: throws on network error or non-2xx response.
 * Use this for React Query / mutations so errors are properly tracked.
 */
export async function apiCallOrThrow<T>(
  url: string,
  method: HttpMethod = 'GET',
  body: unknown = null,
  opts: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<T> {
  const init: RequestInit = { method, headers: { Accept: 'application/json' } };

  if (body !== null && body !== undefined) {
    const headers = new Headers(init.headers);
    headers.set('Content-Type', 'application/json');
    init.headers = headers;
    init.body = JSON.stringify(body);
  }

  const timeoutMs = opts.timeoutMs ?? 12000;

  let timer: ReturnType<typeof setTimeout> | null = null;
  let localAbort: AbortController | null = null;

  if (opts.signal) {
    init.signal = opts.signal;
  } else {
    localAbort = new AbortController();
    init.signal = localAbort.signal;
    timer = setTimeout(() => localAbort?.abort(), timeoutMs);
  }

  try {
    const res = await apiFetch(`${API_BASE}${url}`, init);
    const data = await parseResponseBody(res);
    const headerRid = res.headers.get('x-request-id');

    if (!res.ok) {
      const status = res.status;

      const contract = extractErrorContract(data, headerRid);
      const retryable = contract?.retryable ?? guessRetriableFromStatus(status);

      throw new ApiCallError({
        message: `API ${method} ${url} failed`,
        url,
        method,
        kind: 'HTTP',
        status,
        responseBody: data,

        code: contract?.code,
        requestId: contract?.requestId,
        details: contract?.details,
        retryable,
        retryAfterMs: contract?.retryAfterMs,

        // keep back-compat
        retriable: retryable,

        userMessage: extractUserMessage('HTTP', status, data),
      });
    }
    return data as T;
  } catch (e: unknown) {
    if (e instanceof ApiCallError) throw e;

    const errName = isRecord(e) && typeof e.name === 'string' ? e.name : undefined;
    const kind: ApiErrorKind = errName === 'AbortError' ? 'TIMEOUT' : 'NETWORK';
    throw new ApiCallError({
      message: `API ${method} ${url} failed`,
      url,
      method,
      kind,
      status: undefined,
      responseBody: null,
      retriable: true,
      userMessage: extractUserMessage(kind, undefined, null),
    });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Compat API: returns null on error (so existing legacy modules keep working).
 * Prefer apiCallOrThrow in new code.
 */
export async function apiCall<T>(
  url: string,
  method: HttpMethod = 'GET',
  body: unknown = null,
  opts: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<T | null> {
  try {
    return await apiCallOrThrow<T>(url, method, body, opts);
  } catch (e) {
    // 保持 legacy 行为：不抛出，只记录
    // eslint-disable-next-line no-console
    console.error('apiCall failed:', method, url, e);
    return null;
  }
}

// --- date helpers ---
export function formatDate(input?: string | Date | null): string {
  if (!input) return '';
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return '';
    return input.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
  }

  const raw = String(input).trim();
  if (!raw) return '';

  // Handle date-only safely in local time to avoid TZ shift (YYYY-MM-DD)
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  let d: Date;
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const da = Number(m[3]);
    d = new Date(y, mo - 1, da);
  } else {
    d = new Date(raw);
  }

  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
}

/**
 * formatDate: UI-friendly date label
 * - Accepts ISO string / Date / null
 * - Returns '' when empty
 */
