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
