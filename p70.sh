set -euo pipefail
cd ~/pc-inventory-master

# 0) 备份当前破碎 utils.ts（留档）
cp -a client/src/utils.ts "client/src/utils.ts.broken_keep.$(date +%Y%m%d_%H%M%S)"

# 1) 恢复到 HEAD 的干净版本（关键！）
git restore --source=HEAD --staged --worktree client/src/utils.ts

# 2) 用“正确定位函数体”的脚本替换 block：
#    替换范围：HttpMethod 声明之后 → apiCallOrThrow 函数体结束（函数体从 `): Promise...` 后的 `{` 开始）
python3 - <<'PY'
import re
from pathlib import Path

p = Path("client/src/utils.ts")
s = p.read_text(encoding="utf-8")

m_http = re.search(r"^export type HttpMethod\s*=.*?;\s*$", s, flags=re.M)
if not m_http:
    raise SystemExit("ERROR: cannot find `export type HttpMethod = ...;`")
http_end = m_http.end()

m_fn = re.search(r"export\s+async\s+function\s+apiCallOrThrow\b", s)
if not m_fn:
    raise SystemExit("ERROR: cannot find apiCallOrThrow")

# 在函数起点之后，找到 `) : Promise<...>`（可能跨行）
m_ret = re.search(r"\)\s*:\s*Promise<[^>]+>\s*", s[m_fn.start():], flags=re.S)
if not m_ret:
    raise SystemExit("ERROR: cannot find `): Promise<...>` in apiCallOrThrow signature")

ret_end_abs = m_fn.start() + m_ret.end()

# 函数体的 { 一定在 return type 之后
brace_l = s.find("{", ret_end_abs)
if brace_l < 0:
    raise SystemExit("ERROR: cannot find function body `{` after return type")

# 匹配到函数体结束 }
depth = 0
brace_r = None
for i in range(brace_l, len(s)):
    c = s[i]
    if c == "{":
        depth += 1
    elif c == "}":
        depth -= 1
        if depth == 0:
            brace_r = i + 1
            break
if brace_r is None:
    raise SystemExit("ERROR: unbalanced braces in apiCallOrThrow body")

block = """

export type ApiErrorKind = 'NETWORK' | 'TIMEOUT' | 'HTTP' | 'PARSE' | 'UNKNOWN';

export class ApiCallError extends Error {
  url: string;
  method: HttpMethod;
  kind: ApiErrorKind;
  status?: number;
  responseBody?: unknown;
  retriable: boolean;
  userMessage: string;

  // Back-compat signature
  constructor(message: string, url: string, status?: number, responseBody?: unknown);
  // New structured signature
  constructor(init: {
    message: string;
    url: string;
    method: HttpMethod;
    kind: ApiErrorKind;
    status?: number;
    responseBody?: unknown;
    retriable: boolean;
    userMessage: string;
  });
  constructor(a: any, b?: any, c?: any, d?: any) {
    const legacy = typeof a === 'string';
    const init = legacy
      ? ({
          message: a as string,
          url: b as string,
          method: 'GET' as HttpMethod,
          kind: 'HTTP' as ApiErrorKind,
          status: c as (number | undefined),
          responseBody: d as unknown,
          retriable: true,
          userMessage: (typeof d === 'string' && d ? d.slice(0, 240) : (c ? `Request failed (${c})` : 'Request failed')),
        })
      : (a as any);

    super(init.message);
    this.name = 'ApiCallError';
    this.url = init.url;
    this.method = init.method;
    this.kind = init.kind;
    this.status = init.status;
    this.responseBody = init.responseBody;
    this.retriable = init.retriable;
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
  const anyBody: any = body as any;
  const m = anyBody?.error?.message ?? anyBody?.message ?? (typeof anyBody === 'string' ? anyBody : null);

  if (m && typeof m === 'string') return m.slice(0, 240);

  if (kind === 'TIMEOUT') return 'Request timed out';
  if (kind === 'NETWORK') return 'Network error (server unreachable)';
  if (kind === 'HTTP') return status ? `Request failed (${status})` : 'Request failed';
  return 'Request failed';
}

/**
 * Strict API: throws on network error or non-2xx response.
 */
export async function apiCallOrThrow<T>(
  url: string,
  method: HttpMethod = 'GET',
  body: any = null,
  opts: { signal?: AbortSignal; timeoutMs?: number } = {}
): Promise<T> {
  const init: RequestInit = { method, headers: { 'Accept': 'application/json' } };
  if (body !== null && body !== undefined) {
    (init.headers as any)['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  const timeoutMs = opts.timeoutMs ?? 12000;
  let timer: any = null;
  let localAbort: AbortController | null = null;

  if (opts.signal) {
    init.signal = opts.signal;
  } else {
    localAbort = new AbortController();
    init.signal = localAbort.signal;
    timer = setTimeout(() => localAbort?.abort(), timeoutMs);
  }

  try {
    const res = await fetch(`${API_BASE}${url}`, init);
    const data = await parseResponseBody(res);

    if (!res.ok) {
      const status = res.status;
      throw new ApiCallError({
        message: `API ${method} ${url} failed`,
        url,
        method,
        kind: 'HTTP',
        status,
        responseBody: data,
        retriable: guessRetriableFromStatus(status),
        userMessage: extractUserMessage('HTTP', status, data),
      });
    }

    return data as T;
  } catch (e: any) {
    if (e instanceof ApiCallError) throw e;
    const kind: ApiErrorKind = e?.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK';
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
"""

# 用新 block 替换 http_end -> brace_r（会完整覆盖旧 ApiCallError/parseResponseBody/apiCallOrThrow）
new_s = s[:http_end] + block + s[brace_r:]
p.write_text(new_s, encoding="utf-8", newline="\\n")
print("✅ utils.ts API block replaced cleanly")

# 兜底校验：不应残留那种顶层 "= {}" 或 "): Promise<T> {" 片段
if re.search(r"^\\s*=\\s*\\{\\}\\s*$", new_s, flags=re.M):
    raise SystemExit("ERROR: stray `= {}` still present")
PY

# 3) 快速看一下关键段附近（确认没有残留怪行）
nl -ba client/src/utils.ts | sed -n '40,120p'
