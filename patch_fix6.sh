python3 - <<'PY'
from pathlib import Path
import re, textwrap

p = Path("client/src/utils.ts")
txt = p.read_text(encoding="utf-8")

m = re.search(r"export async function apiCall[\s\S]*?\n}\n", txt)
if not m:
    raise SystemExit("apiCall block not found")

new_block = textwrap.dedent("""\
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export class ApiCallError extends Error {
    url: string;
    status?: number;
    responseBody?: unknown;

    constructor(message: string, url: string, status?: number, responseBody?: unknown) {
        super(message);
        this.name = 'ApiCallError';
        this.url = url;
        this.status = status;
        this.responseBody = responseBody;
    }
}

async function parseResponseBody(res: Response): Promise<unknown> {
    const ct = res.headers.get('content-type') || '';
    try {
        if (ct.includes('application/json')) return await res.json();
        return await res.text();
    } catch {
        return null;
    }
}

/**
 * Strict API: throws on network error or non-2xx response.
 * Use this for React Query / mutations so errors are properly tracked.
 */
export async function apiCallOrThrow<T>(
    url: string,
    method: HttpMethod = 'GET',
    body: any = null,
    opts: { signal?: AbortSignal } = {}
): Promise<T> {
    const init: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json' },
        signal: opts.signal,
    };
    if (body !== null && body !== undefined) init.body = JSON.stringify(body);

    const res = await fetch(`${API_BASE}${url}`, init);
    const data = await parseResponseBody(res);

    if (!res.ok) {
        throw new ApiCallError(`API ${method} ${url} failed`, url, res.status, data);
    }
    return data as T;
}

/**
 * Compat API: returns null on error (so existing modules keep compiling).
 * Prefer apiCallOrThrow in new code.
 */
export async function apiCall<T>(
    url: string,
    method: HttpMethod = 'GET',
    body: any = null,
    opts: { signal?: AbortSignal } = {}
): Promise<T | null> {
    try {
        return await apiCallOrThrow<T>(url, method, body, opts);
    } catch (e) {
        console.error('apiCall failed:', method, url, e);
        return null;
    }
}
""")

txt = txt[:m.start()] + new_block + txt[m.end():]
p.write_text(txt, encoding="utf-8")
print("updated:", p)
PY

git add -A
git commit -m "phase1: apiCall strict/compat split"
git tag -a phase1-$(date +%Y%m%d) -m "phase1: reliable api layer"

