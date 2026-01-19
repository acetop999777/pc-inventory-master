import React from 'react';

/**
 * 你项目里 SaveQueue 的 hook/ctx 名字可能不同：
 * - 可能是: import { useSaveQueue } from '../app/saveQueue/SaveQueueProvider';
 * - 或: import { useSaveQueue } from '../providers/SaveQueueProvider';
 * - 或: import { useSaveQueueState } from ...
 *
 * 这里保持最常见命名：useSaveQueue
 * 如果编译报“找不到模块/导出”，就把这一行改成你项目真实路径/导出名。
 */
import { useSaveQueue } from '../app/saveQueue/SaveQueueProvider';

type ViewState = 'hidden' | 'saving' | 'saved' | 'error';

export default function SyncStatus() {
  const sq: any = useSaveQueue();

  // 兼容不同字段命名：status / state / syncStatus
  const rawStatus: string =
    (sq?.status as string) || (sq?.state as string) || (sq?.syncStatus as string) || 'idle';

  // 兼容不同错误字段命名
  const lastError = sq?.lastError || sq?.error || sq?.syncError || null;

  // 兼容不同重试方法命名：flush / retry / flushNow / retryNow
  const retryFn: () => Promise<any> | any =
    sq?.retry || sq?.flush || sq?.flushNow || sq?.retryNow || (() => {});

  const isDirty: boolean =
    Boolean(sq?.isDirty) ||
    Boolean(sq?.dirty) ||
    Boolean(sq?.hasPending) ||
    Boolean(sq?.pending?.length);

  // 统一 status 语义
  // 你现有 SaveQueue 可能是：idle | saving | error | synced/saved
  const normalized = (() => {
    const s = (rawStatus || '').toLowerCase();
    if (s.includes('saving') || s.includes('flushing')) return 'saving';
    if (s.includes('error') || s.includes('failed')) return 'error';
    if (s.includes('saved') || s.includes('synced') || s.includes('success')) return 'saved';
    // idle / default
    return 'idle';
  })();

  // idle 不常驻：只有 dirty 才露头（否则完全隐藏）
  const baseView: ViewState = (() => {
    if (normalized === 'saving') return 'saving';
    if (normalized === 'error') return 'error';
    if (normalized === 'saved') return 'saved';
    // idle
    if (isDirty) return 'saving'; // 有改动但还没 flush：用 saving 让用户知道“未保存”
    return 'hidden';
  })();

  const [view, setView] = React.useState<ViewState>(baseView);
  const [fading, setFading] = React.useState(false);

  React.useEffect(() => {
    // 状态变化 -> 同步到 view（带 saved 的 2s 自动消失）
    if (baseView === 'saved') {
      setView('saved');
      setFading(false);

      const t1 = setTimeout(() => setFading(true), 1500); // 先开始淡出
      const t2 = setTimeout(() => {
        setView('hidden');
        setFading(false);
      }, 2000);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }

    // saving / error / hidden：立即切换
    setView(baseView);
    setFading(false);
  }, [baseView]);

  if (view === 'hidden') return null;

  const commonStyle: React.CSSProperties = {
    position: 'fixed',
    right: 16,
    bottom: 16,
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 10,
    boxShadow: '0 6px 20px rgba(0,0,0,0.15)',
    fontSize: 14,
    lineHeight: 1,
    transition: 'opacity 250ms ease, transform 250ms ease',
    opacity: fading ? 0 : 1,
    transform: fading ? 'translateY(6px)' : 'translateY(0)',
  };

  const spinner: React.CSSProperties = {
    width: 14,
    height: 14,
    borderRadius: 999,
    border: '2px solid rgba(255,255,255,0.35)',
    borderTopColor: 'rgba(255,255,255,0.95)',
    animation: 'spin 0.9s linear infinite',
  };

  const btn: React.CSSProperties = {
    border: '1px solid rgba(255,255,255,0.45)',
    background: 'rgba(255,255,255,0.15)',
    color: 'white',
    borderRadius: 8,
    padding: '6px 10px',
    cursor: 'pointer',
    fontSize: 13,
    lineHeight: 1,
  };

  const bg = view === 'error' ? '#b42318' : view === 'saved' ? '#027a48' : '#1d2939';

  const label = view === 'error' ? 'Sync failed' : view === 'saved' ? 'Saved' : 'Saving…';

  const detail =
    view === 'error'
      ? lastError?.message || lastError?.error?.message || lastError?.toString?.() || ''
      : '';

  async function onRetry() {
    try {
      await retryFn();
    } catch {
      // 由 SaveQueue 自己进入 error 状态
    }
  }

  return (
    <>
      <style>
        {`@keyframes spin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }`}
      </style>

      <div style={{ ...commonStyle, background: bg }}>
        {view === 'saving' ? <div style={spinner} /> : null}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontWeight: 700 }}>{label}</div>
          {view === 'error' && detail ? (
            <div style={{ opacity: 0.9, fontSize: 12, maxWidth: 360 }}>{detail}</div>
          ) : null}
        </div>

        {view === 'error' ? (
          <button style={btn} onClick={onRetry}>
            Retry
          </button>
        ) : null}
      </div>
    </>
  );
}
