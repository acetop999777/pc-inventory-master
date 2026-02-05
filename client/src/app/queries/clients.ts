import { useQuery } from '@tanstack/react-query';
import { api } from '../../shared/api/http';
import { ClientEntity } from '../../domain/client';
import { decodeClients } from '../../shared/api/decoders';

export const clientsQueryKey = ['clients'] as const;

export function useClientsQuery() {
  return useQuery<ClientEntity[]>({
    queryKey: clientsQueryKey,
    queryFn: async () => {
      const raw = await api.get<unknown>('/clients');
      return decodeClients('/clients', raw);
    },
  });
}
