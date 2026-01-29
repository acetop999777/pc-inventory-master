# Architecture

## High-level

This repo is a small monorepo with two runtime services:

- `server/`: Express API, Postgres persistence, basic migrations
- `client/`: React UI (CRA), React Query cache + write-behind queue

## Directory map

### Root

- `docker-compose.yml`: DB + API + nginx client (prod-style)
- `docker-compose.dev.yml`: overrides for dev hot reload + server watch
- `mk.sh`: convenience entrypoint (`./mk.sh dev`)
- `scripts/`: verification and helper scripts
- `server/db/migrations/`: SQL migrations (source of truth)

### Client (`client/src`)

- `app/`
  - `providers/AppProviders.tsx`: top-level providers (React Query, SaveQueue, Confirm modal)
  - `queries/`: React Query fetchers (clients, inventory)
  - `writeBehind/`: write-behind wrappers (clients, inventory)
  - `saveQueue/`: queue that debounces/merges writes, surfaces sync status
  - `confirm/ConfirmProvider.tsx`: in-app modal replacement for `window.confirm/alert`
- `features/clients/`
  - `ClientsRoutes.tsx`: list/detail routes + draft store + “draft commit” policy
  - `ClientDetailPage.tsx`: screen composed from editor cards
  - `editor/`: specs/financials/identity/logistics UI
    - `pcpp.ts`: PCPartPicker parsing
- `presentation/`
  - `layouts/MainLayout.tsx`: shell layout + nav
  - `modules/*`: each app view UI (`ClientHub`, `InventoryHub`, `InboundHub`, `Dashboard`)
- `domain/`
  - pure logic & types (e.g. financial computations, inbound parsing)

### Server (`server/`)

- `index.js`: express app + routes + DB init
- `services/`: transactional business logic (inventory batch, logs)
- `repositories/`: SQL-only data access helpers
- `db/tx.js`: transaction helper (BEGIN/COMMIT/ROLLBACK)
- `db/migrate.js`: migration runner
- `db/migrations/*.sql`: schema migrations
- `middleware/*`: request id + error handling

## Data model (main tables)

From `server/db/migrations/*.sql` and `server/index.js` baseline init:

- `clients`: customer + order metadata, `specs` JSONB, `photos` JSONB
- `inventory`: parts inventory with weighted average cost (`cost`) and `quantity`
- `audit_logs`: inventory change history (used by inbound/stock flows)
- `product_cache`: barcode lookup cache
- `idempotency_keys`: operationId de-dupe for critical writes
- `inventory_movements`: append-only inventory ledger (receive/consume/adjust/opening)
- `inbound_receipts`: receipt headers (vendor/mode/notes/received_at)
- `inbound_receipt_items`: receipt line items

## API surface (server)

Routes are mounted under `/api`:

- `GET /api/health`
- `GET /api/clients`
- `GET /api/clients/:id`
- `POST /api/clients` (upsert)
- `DELETE /api/clients/:id`
- `GET /api/inventory`
- `POST /api/inventory/batch`
- `DELETE /api/inventory/:id`
- `GET /api/dashboard/stats`
- `POST /api/dashboard/profit`
- `GET /api/lookup/:code`
- `GET /api/logs`
- `POST /api/logs`

## Client write-behind (important)

The UI applies optimistic updates and queues network writes:

- Clients: `client/src/app/writeBehind/clientWriteBehind.ts`
- Inventory: `client/src/app/writeBehind/inventoryWriteBehind.ts`

This reduces “type → POST on every keystroke” and allows retry/error surfacing through SaveQueue UI.

## UI modal policy

Browser-native dialogs are avoided. Use:

- `useConfirm()` for confirm dialogs
- `useAlert()` for “OK-only” notices

Both are in `client/src/app/confirm/ConfirmProvider.tsx`.

Note: browser `beforeunload` cannot be custom-styled (browser enforced).
