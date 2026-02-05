export const formatMoney = (
  n: number | undefined,
  options: Intl.NumberFormatOptions = {},
): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    ...options,
  }).format(n || 0);

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

export function formatDateTime(input?: string | Date | null): string {
  if (!input) return '';
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateShort(input?: string | Date | null): string {
  if (!input) return '';
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return '';
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit' }).format(input);
  }

  const raw = String(input).trim();
  if (!raw) return '';

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
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit' }).format(d);
}

export function formatDateYMD(input?: string | Date | null): string {
  if (!input) return '';
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
