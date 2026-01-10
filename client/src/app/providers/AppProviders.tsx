import React from 'react';

type Props = { children: React.ReactNode };

/**
 * Phase 1: 先做一个“纯壳”Provider，保证能编译跑起来。
 * 后续上 React Query / Router / DI 时，再把 Provider 逐个加进来。
 */
export function AppProviders({ children }: Props) {
  return <>{children}</>;
}
