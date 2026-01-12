set -euo pipefail
cd ~/pc-inventory-master

cat > client/src/app/navigation/NavigationGuard.tsx <<'EOF'
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';

type GuardFn = () => Promise<boolean>;
type BeforeProceed = (() => void) | null;

type Ctx = {
  setGuard: (fn: GuardFn | null) => void;
  // nextNavigate: 触发一次导航（hash 会变化）
  // beforeProceed: 仅在 guard 允许离开时执行（用于清理 draft 等）
  run: (nextNavigate: () => void, beforeProceed?: () => void) => Promise<void>;
};

const NavigationGuardContext = createContext<Ctx | null>(null);

export function NavigationGuardProvider({ children }: { children: React.ReactNode }) {
  const guardRef = useRef<GuardFn | null>(null);
  const enabledRef = useRef<boolean>(false);

  const beforeProceedRef = useRef<BeforeProceed>(null);

  const currentHashRef = useRef<string>('');
  const suppressRef = useRef<boolean>(false);

  useEffect(() => {
    // 初始化当前 hash（避免第一次 hashchange 判断错误）
    if (typeof window !== 'undefined') currentHashRef.current = window.location.hash || '';
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onHashChange = async () => {
      // suppress: 我们自己回滚 hash 时会触发一次 hashchange，要跳过
      if (suppressRef.current) {
        suppressRef.current = false;
        currentHashRef.current = window.location.hash || '';
        return;
      }

      const newHash = window.location.hash || '';
      const oldHash = currentHashRef.current || '';

      // 没有变化或未启用 guard：直接接受
      if (!enabledRef.current || !guardRef.current) {
        currentHashRef.current = newHash;
        beforeProceedRef.current = null;
        return;
      }
      if (newHash === oldHash) return;

      const ok = await guardRef.current();

      if (ok) {
        try {
          beforeProceedRef.current?.();
        } finally {
          beforeProceedRef.current = null;
          currentHashRef.current = newHash;
        }
      } else {
        beforeProceedRef.current = null;
        // 回滚到旧 hash
        suppressRef.current = true;
        window.location.hash = oldHash;
      }
    };

    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const setGuard = useCallback((fn: GuardFn | null) => {
    guardRef.current = fn;
    enabledRef.current = Boolean(fn);
  }, []);

  const run = useCallback(async (nextNavigate: () => void, beforeProceed?: () => void) => {
    if (typeof window === 'undefined') {
      beforeProceed?.();
      nextNavigate();
      return;
    }

    const oldHash = window.location.hash || '';

    // 没 guard：直接执行，并在导航前做 beforeProceed
    if (!enabledRef.current || !guardRef.current) {
      beforeProceed?.();
      nextNavigate();
      return;
    }

    // 有 guard：记录允许离开前做的事，然后发起导航（由 hashchange 决定 proceed/rollback）
    beforeProceedRef.current = beforeProceed ?? null;
    nextNavigate();

    // 如果 nextNavigate 没有真正改变 hash，避免 beforeProceed 悬挂到下一次导航
    setTimeout(() => {
      const nowHash = window.location.hash || '';
      if (nowHash === oldHash) {
        beforeProceedRef.current = null;
      }
    }, 0);
  }, []);

  const value = useMemo(() => ({ setGuard, run }), [setGuard, run]);

  return <NavigationGuardContext.Provider value={value}>{children}</NavigationGuardContext.Provider>;
}

export function useNavigationGuard() {
  const ctx = useContext(NavigationGuardContext);
  if (!ctx) throw new Error('useNavigationGuard must be used within NavigationGuardProvider');
  return ctx;
}
EOF

# 确认不再引用 unstable_useBlocker
grep -RIn "unstable_useBlocker" client/src/app/navigation/NavigationGuard.tsx && exit 1 || true

# 重建 + smoke
if docker compose version >/dev/null 2>&1; then DC="docker compose"; else DC="docker-compose"; fi
$DC up -d --build
./scripts/smoke.sh
