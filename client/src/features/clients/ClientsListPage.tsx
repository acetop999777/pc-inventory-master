import React from 'react';
import type { ClientsListPageProps, ClientsListPageExtraProps } from './types';
import ClientHub from '../../presentation/modules/ClientHub/ClientHub';

type Props = ClientsListPageProps & ClientsListPageExtraProps;

export function ClientsListPage({
  clients,
  activeClientId,
  getFinancials,
  onSelectClient,
  onNewClient,
  onDeleteClient,
}: Props) {
  return (
    <div className="w-full">
      <ClientHub
        clients={clients}
        activeClientId={activeClientId}
        getFinancials={getFinancials}
        onSelectClient={onSelectClient}
        onNewClient={onNewClient}
        onDeleteClient={onDeleteClient}
      />
    </div>
  );
}
