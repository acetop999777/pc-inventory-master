cd ~/pc-inventory-master
set -euo pipefail

echo "=== 1) Fix: export ApiFetchInit from client/src/lib/api.ts (and make apiFetch robust) ==="
mkdir -p client/src/lib
cat > client/src/lib/api.ts <<'EOF'
/**
 * Stable fetch wrapper for the whole client app.
 * - Supports init.query: auto append query string
 * - Supports init.json: auto JSON.stringify + set Content-Type
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
  // keep relative path if input was relative
  const out = u.pathname + (u.search ? u.search : '') + (u.hash ? u.hash : '');
  return out.startsWith('http') ? u.toString() : out;
}

export async function apiFetch(input: RequestInfo | URL, init: ApiFetchInit = {}): Promise<Response> {
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
EOF

echo "=== 2) Patch our generated local shims (*/lib/api.ts) to also export ApiFetchInit ==="
mapfile -t SHIMS < <(grep -R --files-with-matches "Local shim for import: from './lib/api'" client/src 2>/dev/null || true)
for f in "${SHIMS[@]}"; do
  cat > "$f" <<'EOF'
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

export async function apiFetch(input: RequestInfo | URL, init: ApiFetchInit = {}): Promise<Response> {
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
EOF
  echo "✅ patched shim: $f"
done

echo "=== 3) Rebuild client ==="
docker compose build client
docker compose up -d client
docker compose ps
