/**
 * Local shim for import: from './lib/api'
 * (generated automatically)
 */
export type ApiFetchInit = Omit<RequestInit, 'body'> & {
  query?: Record<string, string | number | boolean | null | undefined>;
  json?: unknown;
  body?: BodyInit | null;
};

function withQuery(url: string, query?: ApiFetchInit['query']): string {
  if (!query) return url;
  const u = new URL(url, window.location.origin);
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null) continue;
    u.searchParams.set(k, String(v));
  }
  const out = u.pathname + (u.search ? u.search : '') + (u.hash ? u.hash : '');
  return out.startsWith('http') ? u.toString() : out;
}

export async function apiFetch(
  input: RequestInfo | URL,
  init: ApiFetchInit = {},
): Promise<Response> {
  let url = typeof input === 'string' ? input : input.toString();
  url = withQuery(url, init.query);

  const headers = new Headers(init.headers || {});
  let body: BodyInit | null | undefined = init.body;

  if (init.json !== undefined) {
    body = JSON.stringify(init.json);
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  }

  return fetch(url, {
    ...init,
    headers,
    body,
  });
}
