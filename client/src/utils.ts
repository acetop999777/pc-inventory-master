import { InventoryItem } from './types';
import { apiFetch } from './lib/api';

export const API_BASE = '/api';
export const generateId = (): string => Math.random().toString(36).substr(2, 9);
export const formatMoney = (n: number | undefined): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);

// 1. 只有这一套标准，全系统通用
export const CORE_CATS = ['CPU', 'COOLER', 'MB', 'RAM', 'SSD', 'GPU', 'CASE', 'PSU'];
export const ALL_CATS = [...CORE_CATS, 'FAN', 'MONITOR', 'CUSTOM', 'OTHER'];
export const STATUS_STEPS = ['Deposit Paid', 'Parts Ordered', 'Building', 'Ready', 'Delivered'];

// 2. 及其单纯的判断逻辑：进来的名字 -> 直接定死标准类目
export const guessCategory = (name: string): string => {
  if (!name) return 'OTHER';
  const n = name.toLowerCase();

  if (n.includes('cpu') || n.includes('ryzen') || n.includes('intel') || n.includes('processor'))
    return 'CPU';
  if (
    n.includes('motherboard') ||
    n.includes('b860') ||
    n.includes('b850') ||
    n.includes('b760') ||
    n.includes('b650') ||
    n.includes('x870e') ||
    n.includes('x870') ||
    n.includes('x670') ||
    n.includes('z890') ||
    n.includes('z790')
  )
    return 'MB';
  if (n.includes('memory') || n.includes('ram') || n.includes('ddr5')) return 'RAM';
  if (
    n.includes('video card') ||
    n.includes('geforce') ||
    n.includes('rtx') ||
    n.includes('graphics card')
  )
    return 'GPU';
  if (n.includes('ssd') || n.includes('nvme') || n.includes('m.2')) return 'SSD';
  if (n.includes('cooler') || n.includes('liquid') || n.includes('aio') || n.includes('heatsink'))
    return 'COOLER';
  if (n.includes('supply') || n.includes('psu') || n.includes('modular')) return 'PSU';
  if (n.includes('case') || n.includes('tower') || n.includes('chassis') || n.includes('o11'))
    return 'CASE';
  if (n.includes('fan') || n.includes('uni fan')) return 'FAN';
  if (n.includes('monitor') || n.includes('display')) return 'MONITOR';

  return 'OTHER';
};

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
    details?: any;
    retryable?: boolean;
    retryAfterMs?: number;
    requestId?: string;
  };
};

function extractErrorContract(
  body: unknown,
  headerRequestId?: string | null,
): ErrorContract['error'] | null {
  const anyBody: any = body as any;
  const e = anyBody?.error;
  if (!e || typeof e !== 'object') return null;

  const code = typeof e.code === 'string' && e.code ? e.code : 'HTTP_ERROR';
  const message =
    typeof e.message === 'string' && e.message
      ? e.message
      : typeof anyBody?.message === 'string'
        ? anyBody.message
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
  constructor(init: {
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
  });
  constructor(a: any, b?: any, c?: any, d?: any) {
    const legacy = typeof a === 'string';
    const init = legacy
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
      : (a as any);

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
  const anyBody: any = body as any;

  // New contract: { error: { code, message, details } }
  const err = anyBody?.error;
  const code = typeof err?.code === 'string' ? err.code : undefined;

  // Prefer first field message for validation failures (better UX even before inline errors land)
  if (code === 'VALIDATION_FAILED' || code === 'INVALID_ARGUMENT') {
    const fields = err?.details?.fields;
    if (Array.isArray(fields) && fields.length > 0) {
      const msg = fields[0]?.message;
      if (typeof msg === 'string' && msg) return msg.slice(0, 240);
    }
  }

  const m =
    typeof err?.message === 'string' && err.message
      ? err.message
      : typeof anyBody?.message === 'string' && anyBody.message
        ? anyBody.message
        : typeof anyBody === 'string'
          ? anyBody
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
  body: any = null,
  opts: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<T> {
  const init: RequestInit = { method, headers: { Accept: 'application/json' } };

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

/**
 * Compat API: returns null on error (so existing legacy modules keep working).
 * Prefer apiCallOrThrow in new code.
 */
export async function apiCall<T>(
  url: string,
  method: HttpMethod = 'GET',
  body: any = null,
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

/**
 * Barcode lookup (legacy modules depend on it).
 * Expects server endpoint: GET /api/lookup/:code
 * Returns {name, category} or null.
 */
export async function lookupBarcode(
  code: string,
): Promise<{ name: string; category: string } | null> {
  const data: any = await apiCall(`/lookup/${encodeURIComponent(code)}`);
  if (data && Array.isArray(data.items) && data.items.length > 0) {
    const item = data.items[0];
    const title = String(item.title ?? '').trim();
    const cat = item.category ? String(item.category) : '';
    return {
      name: title,
      category: guessCategory(cat ? `${cat} ${title}` : title),
    };
  }
  return null;
}

function normalizeForMatch(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

const BRAND_PATTERNS: Array<{ id: string; patterns: RegExp[] }> = [
  { id: 'asus', patterns: [/\basus\b/, /\brog\b/, /\btuf\b/] },
  { id: 'msi', patterns: [/\bmsi\b/] },
  { id: 'gigabyte', patterns: [/\bgigabyte\b/, /\baorus\b/] },
  { id: 'asrock', patterns: [/\basrock\b/] },
  { id: 'corsair', patterns: [/\bcorsair\b/] },
  { id: 'gskill', patterns: [/\bg\.?skill\b/] },
  { id: 'teamgroup', patterns: [/\bteam\s*group\b/, /\bteamgroup\b/] },
  { id: 'kingston', patterns: [/\bkingston\b/] },
  { id: 'crucial', patterns: [/\bcrucial\b/] },
  { id: 'samsung', patterns: [/\bsamsung\b/] },
  { id: 'wd', patterns: [/\bwd\b/, /\bwd_black\b/, /\bwdblack\b/, /\bwestern\s+digital\b/] },
  { id: 'seagate', patterns: [/\bseagate\b/] },
  { id: 'sama', patterns: [/\bsama\b/] },
  { id: 'superflower', patterns: [/\bsuper\s*flower\b/] },
  { id: 'coolermaster', patterns: [/\bcooler\s*master\b/, /\bcoolermaster\b/] },
  { id: 'lianli', patterns: [/\blian\s*li\b/] },
  { id: 'nzxt', patterns: [/\bnzxt\b/] },
  { id: 'thermaltake', patterns: [/\bthermaltake\b/] },
];

const CHIPSET_TOKENS = [
  'x870e',
  'x870',
  'x670',
  'x570',
  'b860',
  'b850',
  'b760',
  'b650',
  'b550',
  'z890',
  'z790',
  'z690',
];

const SERIES_TOKENS = [
  'tuf',
  'strix',
  'crosshair',
  'apex',
  'prime',
  'proart',
  'aorus',
  'taichi',
  'phantom',
  'tomahawk',
  'mag',
  'mpg',
  'suprim',
  'ventus',
];

const MODEL_SUFFIXES = new Set([
  'a',
  'e',
  'f',
  'h',
  'i',
  'm',
  'plus',
  'pro',
  'max',
  'ultra',
  'wifi',
  'wifi7',
]);

const STOP_TOKENS = new Set([
  'gaming',
  'wifi',
  'plus',
  'pro',
  'max',
  'ultra',
  'series',
  'desktop',
  'motherboard',
  'memory',
  'ram',
  'ssd',
  'solid',
  'state',
  'drive',
  'internal',
  'pc',
  'amd',
  'intel',
  'ddr5',
  'ddr4',
  'pcie',
  'express',
  'atx',
  'matx',
  'itx',
  'black',
  'white',
]);

function extractBrandToken(text: string): string | null {
  const raw = String(text || '').toLowerCase();
  if (!raw) return null;
  for (const entry of BRAND_PATTERNS) {
    if (entry.patterns.some((p) => p.test(raw))) return entry.id;
  }
  return null;
}

function extractChipsetToken(text: string): string | null {
  const raw = String(text || '').toLowerCase();
  if (!raw) return null;
  for (const chip of CHIPSET_TOKENS) {
    if (raw.includes(chip)) return chip.toUpperCase();
  }
  return null;
}

function extractSeriesTokens(text: string): Set<string> {
  const raw = String(text || '').toLowerCase();
  const hits = new Set<string>();
  if (!raw) return hits;
  for (const token of SERIES_TOKENS) {
    if (raw.includes(token)) hits.add(token);
  }
  return hits;
}

function extractChipsetModelKeys(text: string): Set<string> {
  const raw = String(text || '').toLowerCase();
  const tokens = raw.replace(/[^a-z0-9]+/g, ' ').split(' ').filter(Boolean);
  const keys = new Set<string>();

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    for (const base of CHIPSET_TOKENS) {
      if (token.startsWith(base)) {
        const suffix = token.slice(base.length);
        if (!suffix) {
          keys.add(base);
          continue;
        }
        if (MODEL_SUFFIXES.has(suffix)) {
          keys.add(base + suffix);
          continue;
        }
        keys.add(base);
      }

      if (token === base) {
        const next = tokens[i + 1];
        if (next && MODEL_SUFFIXES.has(next)) {
          keys.add(base + next);
        }
      }
    }
  }
  return keys;
}

function hasOverlap(a: Set<string>, b: Set<string>): boolean {
  let overlap = false;
  a.forEach((val) => {
    if (b.has(val)) overlap = true;
  });
  return overlap;
}

/**
 * Very lightweight fuzzy match used by inbound logic.
 * - Prefer keyword match (if inventory item.keyword is contained in target)
 * - Then substring name match
 * - Then token hits
 */
export function findBestMatch(
  targetName: string,
  inventory: InventoryItem[],
): InventoryItem | null {
  if (!targetName) return null;

  const cleanTarget = normalizeForMatch(targetName);
  if (!cleanTarget) return null;

  const targetBrand = extractBrandToken(targetName);
  const targetChipset = extractChipsetToken(targetName);
  const targetCategory = guessCategory(targetName);
  const targetSeries = extractSeriesTokens(targetName);
  const targetModelKeys = extractChipsetModelKeys(targetName);

  let best: InventoryItem | null = null;
  let bestScore = 0;

  const tokens = targetName
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !STOP_TOKENS.has(t));

  for (const item of inventory) {
    const cleanName = normalizeForMatch(item.name);
    const cleanKey = normalizeForMatch(item.keyword || '');
    const itemBrand = extractBrandToken(`${item.name || ''} ${item.keyword || ''}`);
    const itemChipset = extractChipsetToken(`${item.name || ''} ${item.keyword || ''}`);
    const itemSeries = extractSeriesTokens(`${item.name || ''} ${item.keyword || ''}`);
    const itemModelKeys = extractChipsetModelKeys(`${item.name || ''} ${item.keyword || ''}`);

    let score = 0;

    if (targetBrand && itemBrand && targetBrand !== itemBrand) continue;
    if (targetChipset && itemChipset && targetChipset !== itemChipset) continue;

    if (targetCategory === 'MB') {
      if (targetSeries.size > 0 && itemSeries.size > 0) {
        const overlap = hasOverlap(targetSeries, itemSeries);
        if (!overlap) continue;
      }

      if (targetModelKeys.size > 0 && itemModelKeys.size > 0) {
        const overlap = hasOverlap(targetModelKeys, itemModelKeys);
        if (!overlap) continue;
      }

      if (targetSeries.size > 0 && itemSeries.size === 0) score -= 40;
      if (targetModelKeys.size > 0 && itemModelKeys.size === 0) score -= 30;
    }

    if (targetCategory !== 'OTHER' && item.category && item.category !== targetCategory) {
      score -= 60;
    }
    if (targetBrand && !itemBrand) score -= 15;
    if (targetChipset && !itemChipset) score -= 15;

    // Keyword is a strong signal
    if (cleanKey && cleanTarget.includes(cleanKey)) score += 100;

    // Exact / near-exact name containment
    if (cleanName && cleanTarget.includes(cleanName) && cleanName.length > 5) score += 80;

    // Token hits
    for (const t of tokens) {
      if (t.length <= 3) continue;
      const isModelToken = /\d/.test(t);
      if (item.name.toLowerCase().includes(t)) score += isModelToken ? 12 : 5;
      if ((item.keyword || '').toLowerCase().includes(t)) score += isModelToken ? 15 : 8;
    }

    // Small bonus: if target contains SKU-like text
    const sku = (item as any).sku ? String((item as any).sku) : '';
    if (sku) {
      const cleanSku = normalizeForMatch(sku);
      if (cleanSku && cleanTarget.includes(cleanSku)) score += 60;
    }

    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }

  return bestScore >= 45 ? best : null;
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
