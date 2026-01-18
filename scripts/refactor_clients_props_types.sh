#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

TYPES="client/src/features/clients/types.ts"
LIST="client/src/features/clients/ClientsListPage.tsx"
DETAIL="client/src/features/clients/ClientDetailPage.tsx"
ROW_FEATURES="client/src/features/clients/ClientRow.tsx"
ROW_PRESENTATION="client/src/presentation/modules/ClientHub/components/ClientRow.tsx"

ROW=""
if [[ -f "$ROW_FEATURES" ]]; then
  ROW="$ROW_FEATURES"
elif [[ -f "$ROW_PRESENTATION" ]]; then
  ROW="$ROW_PRESENTATION"
fi

[[ -f "$LIST" ]] || { echo "❌ missing: $LIST"; exit 1; }
[[ -f "$DETAIL" ]] || { echo "❌ missing: $DETAIL"; exit 1; }
[[ -n "$ROW" ]] || { echo "❌ cannot find ClientRow.tsx (checked: $ROW_FEATURES, $ROW_PRESENTATION)"; exit 1; }

echo "== write: $TYPES =="
mkdir -p "$(dirname "$TYPES")"
cat > "$TYPES" <<'TS'
import type React from 'react';
import type { ClientEntity } from '../../domain/client/client.types';
import type { InventoryItem } from '../../types';

/**
 * Centralized, stable Props types for Clients feature.
 * Goal: avoid props-interface drift causing TS “炸一片”.
 */

export type ClientFinancials = ReturnType<typeof import('../../domain/client/client.logic').calculateFinancials>;

export type StatusStep = string;
export type StatusSteps = ReadonlyArray<StatusStep>;

export type OnDeleteClient = (id: string, name?: string) => void | Promise<void>;

export interface ClientsListPageProps {
  clients: ClientEntity[];

  /**
   * Optional: list page may highlight selected client.
   */
  activeClientId?: string | null;

  /**
   * Optional: legacy list implementations compute row pills via injected fn.
   */
  getFinancials?: (client: ClientEntity) => ClientFinancials;

  /**
   * Actions (optional to reduce churn; list page can render read-only if missing)
   */
  onSelectClient?: (client: ClientEntity) => void;
  onNewClient?: () => void;
  onDeleteClient?: OnDeleteClient;
}

export interface ClientRowProps {
  client: ClientEntity;

  /**
   * Optional: some implementations compute financials outside and pass in.
   */
  financials?: ClientFinancials;

  /**
   * Optional UI flags/actions
   */
  active?: boolean;
  onSelect?: () => void;
  onDelete?: (e: React.MouseEvent) => void;
}

export interface ClientDetailPageProps {
  activeClient: ClientEntity;
  inventory: InventoryItem[];
  financials: ClientFinancials;

  /**
   * Compatibility: some old code used statusOptions, newer uses statusSteps.
   * You can pick ONE inside the component by: const steps = statusSteps ?? statusOptions ?? []
   */
  statusSteps?: StatusSteps;
  statusOptions?: StatusSteps;

  busy?: boolean;
  hasError?: boolean;
  flashSaved?: boolean;

  onRetry?: () => void;
  onUpdateField: (field: keyof ClientEntity, val: any) => void;
  onBack?: () => void;
}
TS

backup() {
  local f="$1"
  cp -f "$f" "$f.bak.$(date +%Y%m%d_%H%M%S)"
}

ensure_import_after_imports() {
  local file="$1"
  local importLine="$2"
  # insert once after the import block
  perl -0777 -i -pe '
    my ($line) = @ARGV;
  ' "$file" >/dev/null 2>&1 || true

  if ! rg -nF "$importLine" "$file" >/dev/null 2>&1; then
    perl -0777 -i -pe '
      my $ins = $ENV{INS};
      s/\A((?:import[^\n]*;\n)+)/$1$ins\n/s or die "no import block found";
    ' "$file" INS="$importLine"
  fi
}

replace_props_block() {
  local file="$1"
  local targetType="$2"

  # interface Props { ... }  -> type Props = X;
  perl -0777 -i -pe '
    my $t = $ENV{T};
    s/\binterface\s+Props\s*\{.*?\n\}\s*\n/type Props = '"$targetType"';\n\n/s
    or s/\btype\s+Props\s*=\s*\{.*?\n\};\s*\n/type Props = '"$targetType"';\n\n/s;
  ' "$file" T="$targetType"
}

echo "== patch: $LIST =="
backup "$LIST"
ensure_import_after_imports "$LIST" "import type { ClientsListPageProps } from './types';"
replace_props_block "$LIST" "ClientsListPageProps"

echo "== patch: $DETAIL =="
backup "$DETAIL"
ensure_import_after_imports "$DETAIL" "import type { ClientDetailPageProps } from './types';"
replace_props_block "$DETAIL" "ClientDetailPageProps"

echo "== patch: $ROW =="
backup "$ROW"
if [[ "$ROW" == "$ROW_PRESENTATION" ]]; then
  ensure_import_after_imports "$ROW" "import type { ClientRowProps } from '../../../../features/clients/types';"
else
  ensure_import_after_imports "$ROW" "import type { ClientRowProps } from './types';"
fi
replace_props_block "$ROW" "ClientRowProps"

echo "== sanity checks =="
# first line must not be shell garbage
for f in "$LIST" "$DETAIL" "$ROW" "$TYPES"; do
  first="$(head -n 1 "$f" || true)"
  echo "[sanity] $(basename "$f") first line: $first"
done

echo "== run fast checks =="
npm run typecheck
npm run test:ci

echo "✅ refactor clients props types done"
