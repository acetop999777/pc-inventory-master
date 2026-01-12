/**
 * Global lightweight HTTP helper for legacy call sites:
 *   const res = await http.get("/api/xxx");
 *   if (!res.ok) ...
 *
 * Exposes: window.http
 */
async function request(method, url, body, init) {
  const opts = { ...(init || {}), method };
  const headers = new Headers(opts.headers || {});

  if (body !== undefined && body !== null && method !== 'GET') {
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    opts.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  opts.headers = headers;
  return fetch(url, opts);
}

const http = {
  get: (url, init) => request('GET', url, undefined, init),
  post: (url, body, init) => request('POST', url, body, init),
  put: (url, body, init) => request('PUT', url, body, init),
  del: (url, init) => request('DELETE', url, undefined, init),
};

if (typeof window !== 'undefined') {
  window.http = http;
}
