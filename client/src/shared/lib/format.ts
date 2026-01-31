export const formatMoney = (n: number | undefined): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);

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
