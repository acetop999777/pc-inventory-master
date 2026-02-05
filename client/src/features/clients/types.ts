import type React from 'react';
import type { ClientEntity, ClientFinancials } from '../../domain/client';
import type { InventoryItem } from '../../domain/inventory/inventory.types';

/**
 * Centralized props/types for Clients feature.
 * Goal: stop “改一处炸一片” due to props drift.
 */

export type StatusStep = string;
export type StatusSteps = ReadonlyArray<StatusStep>;

export type OnDeleteClient = (id: string, name?: string) => void | Promise<void>;
export type UpdateClientField = <K extends keyof ClientEntity>(
  field: K,
  val: ClientEntity[K],
) => void;

/**
 * Some code historically split list page props into "base" + "extra".
 * Keep this export to avoid churn.
 */
export interface ClientsListPageExtraProps {
  activeClientId?: string | null;
  getFinancials?: (client: ClientEntity) => ClientFinancials;
}

export interface ClientsListPageProps extends ClientsListPageExtraProps {
  clients: ClientEntity[];

  onSelectClient?: (client: ClientEntity) => void;
  onNewClient?: () => void;
  onDeleteClient?: OnDeleteClient;
}

/**
 * ClientHub is a presentation module that typically wraps the list UI.
 * Keep it separate because some routes import ClientHub directly.
 */
export interface ClientHubProps extends ClientsListPageProps {
  onArchiveClient?: (id: string, name: string) => void;
}

/**
 * Row props across list implementations.
 * We support both `active` and legacy `isActive` to reduce churn.
 */
export interface ClientRowProps {
  client: ClientEntity;

  archived?: boolean;
  active?: boolean;
  isActive?: boolean;

  onSelect?: () => void;
  onDelete?: (e: React.MouseEvent) => void;
  onArchive?: (e: React.MouseEvent) => void;
}

export interface ClientDetailPageProps {
  activeClient: ClientEntity;
  inventory: InventoryItem[];
  financials: ClientFinancials;

  /**
   * Compatibility: older code used statusOptions; newer uses statusSteps.
   */
  statusSteps?: StatusSteps;
  statusOptions?: StatusSteps;

  busy?: boolean;
  hasError?: boolean;
  flashSaved?: boolean;

  onRetry?: () => void;
  onUpdateField: UpdateClientField;
  onBack?: () => void;
}

export interface ClientEditorCardProps {
  data: ClientEntity;
  update: UpdateClientField;
}

export interface ClientIdentityCardProps extends ClientEditorCardProps {
  onPhotoUpload: () => void;
  onPhotoRemove: (idx: number) => void;
}

export interface ClientLogisticsCardProps extends ClientEditorCardProps {
  statusOptions?: StatusSteps;
  statusSteps?: StatusSteps;
}

export interface ClientFinancialsCardProps extends ClientEditorCardProps {
  financials: ClientFinancials;
}

export interface ClientNotesCardProps extends ClientEditorCardProps {}

export interface ClientSpecsTableProps extends ClientEditorCardProps {
  inventory: InventoryItem[];
  onCalculate?: () => void;
}
