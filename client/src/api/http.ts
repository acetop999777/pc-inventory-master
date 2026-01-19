import { ApiError, type ApiErrorPayload } from './ApiError';
import { apiFetch } from './lib/api';

type FetchLikeResponse = {
  ok: boolean;
  status: number;
  statusText: string;
  url: string;
  headers: Headers;
  text: () => Promise<string>;
  json: <T = any>() => Promise<T>;
};

async function readTextSafely(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

function tryParseJson(text: string): any | null {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function toApiError(
  status: number,
  payload: any,
  fallbackText: string,
  statusText: string,
): ApiError {
  const p = payload as Partial<ApiErrorPayload> | null;
  const code = p?.error?.code || `HTTP_${status}`;
  const message =
    p?.error?.message ||
    (fallbackText ? fallbackText.slice(0, 200) : statusText || 'Request failed');

  return new ApiError({
    code,
    message,
    status,
    retryable: Boolean(p?.error?.retryable),
    requestId: (p?.error?.requestId as any) ?? null,
    details: p?.error?.details,
  });
}

async function requestRaw(input: RequestInfo, init?: RequestInit): Promise<FetchLikeResponse> {
  const res = await apiFetch(input, {
    ...init,
    headers: {
      ...(init?.headers || {}),
    },
  });

  // 只读一次 body，缓存下来，保证 json()/text() 都可重复调用
  const cachedText = await readTextSafely(res);
  const cachedJson = tryParseJson(cachedText);

  return {
    ok: res.ok,
    status: res.status,
    statusText: res.statusText,
    url: res.url,
    headers: res.headers,

    text: async () => cachedText,

    json: async <T = any>() => {
      // 优先返回可解析 JSON
      if (cachedJson !== null) {
        if (!res.ok) {
          // 错误契约：{ error: { code, message, details, retryable, requestId } }
          throw toApiError(res.status, cachedJson, cachedText, res.statusText);
        }
        return cachedJson as T;
      }

      // 不是 JSON
      if (!res.ok) {
        throw toApiError(res.status, null, cachedText, res.statusText);
      }

      // 成功但不是 JSON：让调用者自己决定怎么处理
      // 这里返回 text，避免很多旧代码直接 await res.json() 崩掉
      //（如果你强制所有成功返回都是 JSON，可以改成 throw new Error）
      return cachedText as any as T;
    },
  };
}

function jsonBody(body: any) {
  return body === undefined ? undefined : JSON.stringify(body);
}

export const http = {
  get: (url: string) => requestRaw(url, { method: 'GET' }),

  post: (url: string, body?: any) =>
    requestRaw(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: jsonBody(body),
    }),

  put: (url: string, body?: any) =>
    requestRaw(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: jsonBody(body),
    }),

  del: (url: string) => requestRaw(url, { method: 'DELETE' }),
};
