from pathlib import Path

# Prefer the canonical place if it exists
candidates = [
    Path("client/src/app/query/queryClient.ts"),
    Path("client/src/app/queryClient.ts"),
    Path("client/src/app/providers/queryClient.ts"),
]

target = None
for p in candidates:
    if p.exists():
        target = p
        break

if target is None:
    raise SystemExit("ERROR: cannot find queryClient file. Please locate where QueryClient is created (search 'new QueryClient').")

content = """import { QueryClient } from '@tanstack/react-query';

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
"""

target.write_text(content, encoding="utf-8")
print("✅ wrote:", target)
