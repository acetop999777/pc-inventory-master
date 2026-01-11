import { useQuery } from '@tanstack/react-query';
import { apiCallOrThrow } from '../../utils';
import { ClientEntity } from '../../domain/client/client.types';

export const clientsQueryKey = ['clients'] as const;

export function useClientsQuery() {
  return useQuery<ClientEntity[]>({
    queryKey: clientsQueryKey,
    queryFn: async () => {
      const raw = await apiCallOrThrow<any>('/clients');
      return Array.isArray(raw) ? raw : [];
    },
  });
}
