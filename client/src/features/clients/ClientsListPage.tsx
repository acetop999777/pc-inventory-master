import React from 'react';
import { ClientEntity } from '../../domain/client/client.types';
import ClientHub from '../../presentation/modules/ClientHub/ClientHub';

type Props = {
  clients: ClientEntity[];
  onSelectClient: (c: ClientEntity) => void;
  onNewClient: () => void;
  onDeleteClient: (id: string, name: string) => void;
};

export function ClientsListPage(props: Props) {
  const { clients, onSelectClient, onNewClient, onDeleteClient } = props;
  return (
    <ClientHub
      clients={clients}
      onSelectClient={onSelectClient}
      onNewClient={onNewClient}
      onDeleteClient={onDeleteClient}
    />
  );
}
