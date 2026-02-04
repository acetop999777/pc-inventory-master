import { useQuery } from '@tanstack/react-query';
import { apiCallOrThrow } from '../../shared/api/http';
import { asArray } from '../../shared/api/response';
import { ClientEntity, normalizeClientRow } from '../../domain/client';

export const clientsQueryKey = ['clients'] as const;

export function useClientsQuery() {
  return useQuery<ClientEntity[]>({
    queryKey: clientsQueryKey,
    queryFn: async () => {
      const raw = await apiCallOrThrow<unknown>('/clients');
      return asArray(raw).map(normalizeClientRow);
    },
  });
}
