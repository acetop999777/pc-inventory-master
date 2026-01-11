set -euo pipefail
cd ~/pc-inventory-master

if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DC="docker-compose"
else
  echo "ERROR: need docker compose v2 or docker-compose v1" >&2
  exit 1
fi

python3 - <<'PY'
from pathlib import Path
import re

ROOT = Path("client/src")
candidates = list(ROOT.rglob("SyncStatusPill.tsx"))

# fallback：找包含 SAVED + fixed(top/right) 的 TSX
if not candidates:
    for p in ROOT.rglob("*.tsx"):
        s = p.read_text(encoding="utf-8", errors="ignore")
        if ("SAVED" in s or "Saved" in s) and "fixed" in s and ("top" in s and "right" in s):
            candidates.append(p)

if not candidates:
    raise SystemExit("ERROR: cannot find SyncStatusPill.tsx (or any fixed top-right SAVED pill component)")

component = r"""import React from 'react';
import { useSyncExternalStore } from 'react';
import { CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';
import { useSaveQueue } from './SaveQueueProvider';

export default function SyncStatusPill() {
  const { queue } = useSaveQueue();

  const snap = useSyncExternalStore(
    queue.subscribe,
    () => queue.getSnapshot(),
    () => queue.getSnapshot()
  );

  const busy = (snap.pendingCount + snap.inFlightCount) > 0;
  const hasError = snap.errorCount > 0;

  const [showSaved, setShowSaved] = React.useState(false);
  const prevBusyRef = React.useRef(false);
  const tRef = React.useRef<any>(null);

  React.useEffect(() => {
    const prevBusy = prevBusyRef.current;
    prevBusyRef.current = busy;

    // busy -> idle：短暂显示 Saved
    if (prevBusy && !busy && !hasError) {
      setShowSaved(true);
      if (tRef.current) clearTimeout(tRef.current);
      tRef.current = setTimeout(() => setShowSaved(false), 900);
      return;
    }

    // 有错误：不显示 Saved
    if (hasError) setShowSaved(false);

    // idle 且无错误：不显示任何东西
    if (!busy && !hasError) setShowSaved(false);
  }, [busy, hasError]);

  if (!busy && !hasError && !showSaved) return null;

  const retryAll = () => {
    // 触发重试（不会阻塞 UI）
    void queue.flushAll({ timeoutMs: 8000 });
  };

  return (
    <div className="fixed top-4 right-4 z-[999]">
      <div
        className={[
          "flex items-center gap-2 px-4 py-2 rounded-full border shadow-sm",
          "text-[10px] font-black uppercase tracking-wider",
          hasError
            ? "bg-red-50 border-red-200 text-red-700"
            : busy
              ? "bg-slate-50 border-slate-200 text-slate-600"
              : "bg-emerald-50 border-emerald-200 text-emerald-700"
        ].join(" ")}
      >
        {hasError ? (
          <>
            <AlertTriangle size={14} />
            <span>Needs Sync</span>
            <button
              onClick={retryAll}
              className="ml-2 px-2 py-1 rounded-full bg-white border border-red-200 hover:bg-red-50"
              title="Retry pending saves"
            >
              Retry
            </button>
          </>
        ) : busy ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            <span>Syncing...</span>
          </>
        ) : (
          <>
            <CheckCircle2 size={14} />
            <span>Saved</span>
          </>
        )}
      </div>
    </div>
  );
}
"""

for p in candidates:
    # 只覆盖真正的 SyncStatusPill 组件文件（避免误伤）
    name_ok = (p.name == "SyncStatusPill.tsx")
    content_ok = ("SyncStatusPill" in p.read_text(encoding="utf-8", errors="ignore")) or name_ok
    if not content_ok:
        continue
    p.write_text(component, encoding="utf-8")
    print("patched:", p)

PY

git add -A
git commit -m "phase5.2: sync status pill not sticky (show only syncing/error; saved auto-hide)" || true

TAG="phase5_2-$(date +%Y%m%d)"
if git rev-parse "$TAG" >/dev/null 2>&1; then
  TAG="${TAG}b"
fi
git tag -a "$TAG" -m "phase5.2: hide sticky SAVED pill"

$DC build --no-cache client
$DC up -d
./scripts/smoke.sh
