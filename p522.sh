set -euo pipefail
cd ~/pc-inventory-master

cat > client/src/app/navigation/NavigationGuard.tsx <<'EOF'
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { unstable_useBlocker } from 'react-router-dom';

type GuardFn = () => Promise<boolean>;
type BeforeProceed = (() => void) | null;

type Ctx = {
  setGuard: (fn: GuardFn | null) => void;
  // nextNavigate: 触发一次导航（会被 blocker 拦截）
  // beforeProceed: 仅在 guard 允许离开并 proceed 之前执行（用于清理 draft）
  run: (nextNavigate: () => void, beforeProceed?: () => void) => Promise<void>;
};

const NavigationGuardContext = createContext<Ctx | null>(null);

export function NavigationGuardProvider({ children }: { children: React.ReactNode }) {
  const guardRef = useRef<GuardFn | null>(null);
  const beforeProceedRef = useRef<BeforeProceed>(null);

  // 用 state 驱动 blocker 开关（ref 变化不会触发 re-render）
  const [enabled, setEnabled] = useState(false);

  const blocker = unstable_useBlocker(enabled);

  useEffect(() => {
    if (blocker.state !== 'blocked') return;

    let cancelled = false;

    (async () => {
      const g = guardRef.current;
      const ok = g ? await g() : true;

      if (cancelled) return;

      if (ok) {
        try {
          beforeProceedRef.current?.();
        } finally {
          beforeProceedRef.current = null;
          blocker.proceed();
        }
      } else {
        beforeProceedRef.current = null;
        blocker.reset();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [blocker]);

  const setGuard = useCallback((fn: GuardFn | null) => {
    guardRef.current = fn;
    setEnabled(Boolean(fn));
  }, []);

  const run = useCallback(async (nextNavigate: () => void, beforeProceed?: () => void) => {
    // 没有 guard：直接执行
    if (!guardRef.current) {
      beforeProceed?.();
      nextNavigate();
      return;
    }

    // 有 guard：记录“允许离开前做的事”，然后发起导航（会进入 blocked 流程）
    beforeProceedRef.current = beforeProceed ?? null;
    nextNavigate();
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

# 快速确认类型里 run 有两个参数（可选）
grep -n "run:" -n client/src/app/navigation/NavigationGuard.tsx

# 重建 + smoke
if docker compose version >/dev/null 2>&1; then DC="docker compose"; else DC="docker-compose"; fi
$DC up -d --build
./scripts/smoke.sh
