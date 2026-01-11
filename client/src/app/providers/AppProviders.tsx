import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '../query/queryClient';
import { SaveQueueProvider, useSaveQueue } from '../saveQueue/SaveQueueProvider';

type Props = { children: React.ReactNode };

const queryClient = createQueryClient();

function BeforeUnloadGuard() {
  const { snapshot } = useSaveQueue();
  const pendingCount = snapshot.pendingCount + snapshot.inFlightCount;

  React.useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (pendingCount > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [pendingCount]);

  return null;
}

export function AppProviders({ children }: Props) {
  return (
    <QueryClientProvider client={queryClient}>
      <SaveQueueProvider>
        <BeforeUnloadGuard />
        {children}
      </SaveQueueProvider>
    </QueryClientProvider>
  );
}
