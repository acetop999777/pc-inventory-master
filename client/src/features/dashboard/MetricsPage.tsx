import React from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../shared/api/http';
import { decodeLogs } from '../../shared/api/decoders';
import type { LogEntry } from '../../shared/api/types';
import { Button, Input, Select, panel } from '../../shared/ui';

type MetricRow = {
  ts: number;
  event: string;
  durationMs: number | null;
  status: string;
  requestId: string;
  operationId: string;
  endpoint: string;
  idempotencyHit: boolean | null;
};

function toMs(value: string): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function toStringField(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function toNumberField(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toBoolField(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v;
  return null;
}

function rowFromLog(log: LogEntry): MetricRow {
  const meta = log.meta ?? {};
  const event = toStringField((meta as Record<string, unknown>).event) || log.title || 'metric';
  return {
    ts: Number(log.timestamp || 0),
    event,
    durationMs: toNumberField((meta as Record<string, unknown>).durationMs),
    status: toStringField((meta as Record<string, unknown>).status),
    requestId: toStringField((meta as Record<string, unknown>).requestId),
    operationId: toStringField((meta as Record<string, unknown>).operationId),
    endpoint: toStringField((meta as Record<string, unknown>).endpoint),
    idempotencyHit: toBoolField((meta as Record<string, unknown>).idempotencyHit),
  };
}

function escapeCsv(value: string): string {
  if (!value.includes('"') && !value.includes(',') && !value.includes('\n')) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function MetricsPage() {
  const nav = useNavigate();
  const [logs, setLogs] = React.useState<LogEntry[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [startAt, setStartAt] = React.useState('');
  const [endAt, setEndAt] = React.useState('');
  const [eventFilter, setEventFilter] = React.useState('');
  const [limit, setLimit] = React.useState(200);

  const fetchMetrics = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('type', 'metric');
      params.set('limit', String(limit));
      const from = toMs(startAt);
      const to = toMs(endAt);
      if (from) params.set('from', String(from));
      if (to) params.set('to', String(to));
      if (eventFilter.trim()) params.set('event', eventFilter.trim());

      const url = `/logs?${params.toString()}`;
      const raw = await api.get<unknown>(url);
      const data = decodeLogs(url, raw);
      setLogs(data);
    } catch (err: unknown) {
      const msg =
        typeof (err as { userMessage?: unknown })?.userMessage === 'string'
          ? String((err as { userMessage?: unknown }).userMessage)
          : 'Failed to load metrics.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [endAt, eventFilter, limit, startAt]);

  React.useEffect(() => {
    void fetchMetrics();
  }, [fetchMetrics]);

  const filtered = React.useMemo(() => {
    const startMs = toMs(startAt);
    const endMs = toMs(endAt);
    const needle = eventFilter.trim().toLowerCase();
    return logs.filter((log) => {
      const row = rowFromLog(log);
      if (startMs && row.ts < startMs) return false;
      if (endMs && row.ts > endMs) return false;
      if (needle) {
        const hay = row.event.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [logs, startAt, endAt, eventFilter]);

  const exportCsv = () => {
    const header = [
      'timestamp',
      'event',
      'durationMs',
      'status',
      'requestId',
      'operationId',
      'endpoint',
      'idempotencyHit',
    ];
    const rows = filtered.map((log) => {
      const row = rowFromLog(log);
      return [
        new Date(row.ts).toISOString(),
        row.event,
        row.durationMs == null ? '' : String(row.durationMs),
        row.status,
        row.requestId,
        row.operationId,
        row.endpoint,
        row.idempotencyHit == null ? '' : String(row.idempotencyHit),
      ].map(escapeCsv).join(',');
    });
    const content = [header.join(','), ...rows].join('\n');
    downloadBlob(content, `metrics_${Date.now()}.csv`, 'text/csv');
  };

  const exportJson = () => {
    const rows = filtered.map((log) => rowFromLog(log));
    const content = JSON.stringify(rows, null, 2);
    downloadBlob(content, `metrics_${Date.now()}.json`, 'application/json');
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Button
            onClick={() => nav('/dashboard')}
            size="xs"
            variant="ghost"
            className="text-[10px] font-black uppercase tracking-widest text-slate-400"
          >
            Back
          </Button>
          <h1 className="text-2xl font-black text-slate-900 mt-1">Metrics</h1>
          <div className="text-[11px] font-semibold text-slate-500 mt-1">
            {filtered.length} entries
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={fetchMetrics}
            size="xs"
            variant="ghost"
            className="text-xs font-black uppercase tracking-widest"
          >
            Refresh
          </Button>
          <Button
            onClick={exportCsv}
            size="xs"
            variant="ghost"
            className="text-xs font-black uppercase tracking-widest"
          >
            Export CSV
          </Button>
          <Button
            onClick={exportJson}
            size="xs"
            variant="ghost"
            className="text-xs font-black uppercase tracking-widest"
          >
            Export JSON
          </Button>
        </div>
      </div>

      <div className={`${panel} p-5 mb-6`}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Start
            </div>
            <Input
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              size="sm"
              className="mt-2 text-xs font-bold text-slate-700"
            />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              End
            </div>
            <Input
              type="datetime-local"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              size="sm"
              className="mt-2 text-xs font-bold text-slate-700"
            />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Event Filter
            </div>
            <Input
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              size="sm"
              className="mt-2 text-xs font-bold text-slate-700"
              placeholder="inventory.update.metrics"
            />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Limit
            </div>
            <Select
              value={String(limit)}
              onChange={(e) => setLimit(Number(e.target.value))}
              size="sm"
              variant="soft"
              className="mt-2 text-xs font-bold text-slate-700"
            >
              <option value="200">200</option>
              <option value="500">500</option>
              <option value="1000">1000</option>
            </Select>
          </div>
        </div>
      </div>

      <div className={`${panel} p-4`}>
        {loading && <div className="text-xs text-slate-400">Loading metrics…</div>}
        {error && <div className="text-xs text-rose-600">{error}</div>}
        {!loading && !error && filtered.length === 0 && (
          <div className="text-xs text-slate-400">No metrics found.</div>
        )}
        {!loading && !error && filtered.length > 0 && (
          <div className="overflow-auto">
            <table className="min-w-[900px] w-full text-[11px]">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-widest text-slate-400">
                  <th className="py-2 pr-4">Time</th>
                  <th className="py-2 pr-4">Event</th>
                  <th className="py-2 pr-4">Duration</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Request</th>
                  <th className="py-2 pr-4">Operation</th>
                  <th className="py-2 pr-4">Endpoint</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((log) => {
                  const row = rowFromLog(log);
                  return (
                    <tr key={log.id} className="border-t border-slate-100">
                      <td className="py-2 pr-4 text-slate-600">
                        {row.ts ? new Date(row.ts).toLocaleString() : '-'}
                      </td>
                      <td className="py-2 pr-4 font-semibold text-slate-800">{row.event}</td>
                      <td className="py-2 pr-4 text-slate-600">
                        {row.durationMs == null ? '-' : `${row.durationMs}ms`}
                      </td>
                      <td className="py-2 pr-4 text-slate-600">{row.status || '-'}</td>
                      <td className="py-2 pr-4 text-slate-500">{row.requestId || '-'}</td>
                      <td className="py-2 pr-4 text-slate-500">{row.operationId || '-'}</td>
                      <td className="py-2 pr-4 text-slate-500">{row.endpoint || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
