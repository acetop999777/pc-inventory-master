import React, { createContext, useContext, useMemo } from 'react';
import { useSyncExternalStore } from 'react';
import { SaveQueue, SaveQueueSnapshot } from './SaveQueue';

type Ctx = {
  queue: SaveQueue;
  snapshot: SaveQueueSnapshot;
};

const SaveQueueContext = createContext<Ctx | null>(null);

export function SaveQueueProvider({ children }: { children: React.ReactNode }) {
  const queue = useMemo(() => new SaveQueue(), []);
  const snapshot = useSyncExternalStore(queue.subscribe, () => queue.getSnapshot());

  return <SaveQueueContext.Provider value={{ queue, snapshot }}>{children}</SaveQueueContext.Provider>;
}

export function useSaveQueue() {
  const ctx = useContext(SaveQueueContext);
  if (!ctx) throw new Error('useSaveQueue must be used within SaveQueueProvider');
  return ctx;
}
