import React from 'react';
import type { ClientsListPageExtraProps, ClientsListPageProps } from './types';
import ClientHub from '../../presentation/modules/ClientHub/ClientHub';

type Props = ClientsListPageProps & ClientsListPageExtraProps;

const noop = () => {};

export function ClientsListPage({ clients, onSelectClient, onNewClient, onDeleteClient }: Props) {
  return (
    <ClientHub
      clients={clients}
      onSelectClient={onSelectClient ?? noop}
      onNewClient={onNewClient ?? noop}
      onDeleteClient={(id, name) => onDeleteClient?.(id, name)}
    />
  );
}

export default ClientsListPage;
