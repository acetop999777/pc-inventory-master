import React from 'react';
import { Trash2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useReceiptDetailQuery } from '../../app/queries/receipts';
import { apiCallOrThrow, compressImage } from '../../utils';
import { useAlert } from '../../app/confirm/ConfirmProvider';
import { useQueryClient } from '@tanstack/react-query';

export default function ReceiptDetail() {
  const nav = useNavigate();
  const { id } = useParams();
  const { data } = useReceiptDetailQuery(id || '');
  const alert = useAlert();
  const qc = useQueryClient();
  const uploadRef = React.useRef<HTMLInputElement | null>(null);
  const [images, setImages] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [dragActive, setDragActive] = React.useState(false);
  const [previewSrc, setPreviewSrc] = React.useState<string | null>(null);
  const [receivedAt, setReceivedAt] = React.useState('');
  const [vendor, setVendor] = React.useState('');
  const [mode, setMode] = React.useState('MANUAL');
  const [notes, setNotes] = React.useState('');
  const [itemsDraft, setItemsDraft] = React.useState<
    { id: number; qtyReceived: string; unitCost: string; remove?: boolean }[]
  >([]);

  React.useEffect(() => {
    if (!data?.receipt) return;
    const next = Array.isArray(data.receipt.images) ? data.receipt.images : [];
    setImages(next);
    const dt = data.receipt.receivedAt ? new Date(data.receipt.receivedAt) : null;
    if (dt && !Number.isNaN(dt.getTime())) {
      const pad = (n: number) => String(n).padStart(2, '0');
      setReceivedAt(
        `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(
          dt.getHours(),
        )}:${pad(dt.getMinutes())}`,
      );
    } else {
      setReceivedAt('');
    }
    setVendor(data.receipt.vendor || '');
    setMode(data.receipt.mode || 'MANUAL');
    setNotes(data.receipt.notes || '');
    setItemsDraft(
      data.items.map((it) => ({
        id: it.id,
        qtyReceived: String(it.qtyReceived ?? ''),
        unitCost: String(it.unitCost ?? ''),
        remove: false,
      })),
    );
  }, [data?.receipt, data?.items]);

  if (!data) {
    return <div className="p-8 text-xs text-slate-400">Loading...</div>;
  }

  const { receipt, items } = data;
  const total = items.reduce((sum, it) => {
    const draft = itemsDraft.find((row) => row.id === it.id);
    if (draft?.remove) return sum;
    const qty = Number(draft?.qtyReceived ?? it.qtyReceived ?? 0);
    const cost = Number(draft?.unitCost ?? it.unitCost ?? 0);
    return sum + qty * cost;
  }, 0);

  const saveImages = async (next: string[]) => {
    if (!id) return;
    setSaving(true);
    try {
      const res = await apiCallOrThrow<any>(`/inbound/receipts/${id}`, 'PATCH', {
        images: next,
      });
      if (res?.receipt) {
        qc.setQueryData(['receipt', id], res);
        const updated = Array.isArray(res.receipt.images) ? res.receipt.images : next;
        setImages(updated);
      }
    } catch (err: any) {
      await alert({
        title: 'Upload Failed',
        message: err?.userMessage || 'Failed to save receipt images.',
      });
    } finally {
      setSaving(false);
    }
  };

  const appendImagesFromFiles = async (files: File[]) => {
    if (files.length === 0) return;
    const encoded: string[] = [];
    for (const f of files) {
      if (!String(f.type || '').startsWith('image/')) continue;
      try {
        const url = await compressImage(f);
        if (url) encoded.push(url);
      } catch {
        // ignore
      }
    }
    if (encoded.length > 0) {
      const next = [...images, ...encoded];
      setImages(next);
      await saveImages(next);
    }
  };

  const saveReceipt = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const payload: any = {
        vendor,
        mode,
        notes,
        items: itemsDraft.map((it) =>
          it.remove
            ? { id: it.id, remove: true }
            : {
                id: it.id,
                qtyReceived: Number(it.qtyReceived || 0),
                unitCost: Number(it.unitCost || 0),
              },
        ),
      };
      if (receivedAt) {
        payload.receivedAt = new Date(receivedAt).toISOString();
      }
      const res = await apiCallOrThrow<any>(`/inbound/receipts/${id}`, 'PATCH', payload);
      if (res?.receipt) {
        qc.setQueryData(['receipt', id], res);
      }
    } catch (err: any) {
      await alert({
        title: 'Save Failed',
        message: err?.userMessage || 'Failed to update receipt.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <button
            onClick={() => nav('/inbound/receipts')}
            className="text-[10px] font-black uppercase tracking-widest text-slate-400"
          >
            Back
          </button>
          <h1 className="text-2xl font-black text-slate-900 mt-1">Receipt #{receipt.id}</h1>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total</div>
          <div className="text-xl font-black text-slate-900">${total.toFixed(2)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Received At</div>
          <input
            type="datetime-local"
            value={receivedAt}
            onChange={(e) => setReceivedAt(e.target.value)}
            className="mt-2 w-full text-xs font-bold text-slate-700 border border-slate-200 rounded-xl px-3 py-2"
          />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Vendor</div>
          <input
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            className="mt-2 w-full text-xs font-bold text-slate-700 border border-slate-200 rounded-xl px-3 py-2"
            placeholder="-"
          />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mode</div>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className="mt-2 w-full text-xs font-bold text-slate-700 border border-slate-200 rounded-xl px-3 py-2 uppercase"
          >
            {['MANUAL', 'SCAN', 'SUMMARY'].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Notes</div>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-2 w-full text-xs font-bold text-slate-700 border border-slate-200 rounded-xl px-3 py-2"
            placeholder="optional"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-6">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Receipt Photos</div>
          <button
            onClick={() => uploadRef.current?.click()}
            className="text-[10px] font-black uppercase tracking-wider text-slate-600 hover:text-slate-800"
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Upload'}
          </button>
        </div>

        <input
          ref={uploadRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={async (e) => {
            const files = Array.from(e.target.files || []);
            await appendImagesFromFiles(files);
            e.target.value = '';
          }}
        />

        <div
          className={[
            'mt-3 rounded-2xl border border-dashed px-4 py-4 transition',
            dragActive ? 'border-blue-400 bg-blue-50/60' : 'border-slate-200 bg-slate-50',
          ].join(' ')}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={async (e) => {
            e.preventDefault();
            setDragActive(false);
            const files = Array.from(e.dataTransfer.files || []);
            await appendImagesFromFiles(files);
          }}
          onClick={() => uploadRef.current?.click()}
        >
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Drag & drop images here, or click to upload
          </div>

          {images.length > 0 ? (
            <div className="mt-3 grid grid-cols-3 md:grid-cols-6 gap-3">
              {images.map((img, idx) => (
                <div
                  key={`${img.slice(0, 18)}-${idx}`}
                  className="relative group rounded-xl overflow-hidden border border-slate-100 bg-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewSrc(img);
                  }}
                >
                  <img src={img} alt="" className="h-20 w-full object-cover" />
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation();
                      const next = images.filter((_, i) => i !== idx);
                      setImages(next);
                      await saveImages(next);
                    }}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white text-[10px] opacity-0 group-hover:opacity-100"
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-2 text-[10px] font-bold text-slate-400">
              No photos yet. Upload now or later.
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
          <div className="col-span-5">Item</div>
          <div className="col-span-2">Qty</div>
          <div className="col-span-2">Unit Cost</div>
          <div className="col-span-2 text-right">Line Total</div>
          <div className="col-span-1" />
        </div>
        {items.map((it) => {
          const draft = itemsDraft.find((row) => row.id === it.id);
          if (draft?.remove) return null;
          const qty = Number(draft?.qtyReceived ?? it.qtyReceived ?? 0);
          const cost = Number(draft?.unitCost ?? it.unitCost ?? 0);
          const lineTotal = qty * cost;
          return (
            <div key={it.id} className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-slate-100">
              <div className="col-span-5 text-xs font-bold text-slate-700 truncate">
                {it.displayName || it.sku || it.inventoryId}
              </div>
              <div className="col-span-2">
                <input
                  value={draft?.qtyReceived ?? String(it.qtyReceived)}
                  onChange={(e) => {
                    const next = e.target.value;
                    setItemsDraft((prev) =>
                      prev.map((row) =>
                        row.id === it.id ? { ...row, qtyReceived: next } : row,
                      ),
                    );
                  }}
                  className="w-full text-xs font-mono text-slate-700 border border-slate-200 rounded-xl px-2 py-1"
                />
              </div>
              <div className="col-span-2">
                <input
                  value={draft?.unitCost ?? String(it.unitCost)}
                  onChange={(e) => {
                    const next = e.target.value;
                    setItemsDraft((prev) =>
                      prev.map((row) =>
                        row.id === it.id ? { ...row, unitCost: next } : row,
                      ),
                    );
                  }}
                  className="w-full text-xs font-mono text-slate-700 border border-slate-200 rounded-xl px-2 py-1"
                />
              </div>
              <div className="col-span-2 text-xs font-mono text-slate-700 text-right">
                ${lineTotal.toFixed(2)}
              </div>
              <div className="col-span-1 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setItemsDraft((prev) =>
                      prev.map((row) =>
                        row.id === it.id ? { ...row, remove: true } : row,
                      ),
                    );
                  }}
                  className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-300 hover:text-red-400 hover:bg-red-50"
                  title="Remove"
                  aria-label="Remove"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })}
        {items.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs font-bold">No items</div>
        ) : null}
      </div>

      <div className="flex justify-end mt-4">
        <button
          onClick={saveReceipt}
          disabled={saving}
          className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-lg hover:shadow-xl active:scale-[0.99] transition text-[11px] font-black uppercase tracking-wider disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {previewSrc ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
          <div
            className="absolute inset-0 bg-slate-900/70"
            onClick={() => setPreviewSrc(null)}
          />
          <div className="relative max-w-4xl w-full">
            <button
              type="button"
              onClick={() => setPreviewSrc(null)}
              className="absolute -top-10 right-0 text-white text-sm font-bold"
            >
              Close
            </button>
            <img
              src={previewSrc}
              alt="Receipt"
              className="w-full max-h-[80vh] object-contain rounded-2xl bg-white"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
