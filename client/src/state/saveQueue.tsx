import React from 'react';

export type SaveQueueSnapshot = {
  pendingCount: number;
  inflightCount: number;
  failedCount: number;
};

export type SaveQueueApi = {
  snapshot: SaveQueueSnapshot;
  enqueue<T>(fn: () => Promise<T>): Promise<T>;
  retryAll(): void;
};

/**
 * Shim implementation:
 * - enqueue() runs immediately
 * - snapshot stays at 0 (no background queue)
 * This is enough to satisfy UI compile + basic runtime.
 */
const api: SaveQueueApi = {
  snapshot: { pendingCount: 0, inflightCount: 0, failedCount: 0 },
  async enqueue<T>(fn: () => Promise<T>) {
    return fn();
  },
  retryAll() {},
};

const Ctx = React.createContext<SaveQueueApi>(api);

export function SaveQueueProvider({ children }: { children: React.ReactNode }) {
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useSaveQueue() {
  return React.useContext(Ctx);
}
