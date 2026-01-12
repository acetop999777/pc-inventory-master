import { useQuery } from '@tanstack/react-query';
import { apiCallOrThrow } from '../../utils';
import { ClientEntity } from '../../domain/client/client.types';

export const clientsQueryKey = ['clients'] as const;

async function fetchClients(): Promise<ClientEntity[]> {
  const data = await apiCallOrThrow<ClientEntity[]>('/clients');
  return Array.isArray(data) ? data : [];
}

export function useClientsQuery() {
  return useQuery({
    queryKey: clientsQueryKey,
    queryFn: fetchClients,
  });
}
