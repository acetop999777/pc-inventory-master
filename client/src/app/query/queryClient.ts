import { QueryClient } from '@tanstack/react-query';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Phase7.4: offline-friendly defaults
        // - no retry storms when server is down
        // - don't refetch automatically on focus/reconnect
        retry: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        staleTime: 30_000,
        gcTime: 5 * 60_000,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
