import React, { createContext, useCallback, useContext, useMemo, useRef } from 'react';

type GuardFn = () => Promise<boolean>;

type Ctx = {
  setGuard: (fn: GuardFn | null) => void;
  run: (next: () => void) => Promise<void>;
};

const NavigationGuardContext = createContext<Ctx | null>(null);

export function NavigationGuardProvider({ children }: { children: React.ReactNode }) {
  const guardRef = useRef<GuardFn | null>(null);

  const setGuard = useCallback((fn: GuardFn | null) => {
    guardRef.current = fn;
  }, []);

  const run = useCallback(async (next: () => void) => {
    const g = guardRef.current;
    if (!g) {
      next();
      return;
    }
    const ok = await g();
    if (ok) next();
  }, []);

  const value = useMemo(() => ({ setGuard, run }), [setGuard, run]);

  return <NavigationGuardContext.Provider value={value}>{children}</NavigationGuardContext.Provider>;
}

export function useNavigationGuard() {
  const ctx = useContext(NavigationGuardContext);
  if (!ctx) throw new Error('useNavigationGuard must be used within NavigationGuardProvider');
  return ctx;
}
