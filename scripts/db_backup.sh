#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# load .env if present
set -a
[ -f ./.env ] && . ./.env
set +a

mkdir -p backups

TS="$(date +%Y%m%d_%H%M%S)"
DB="${POSTGRES_DB:-inventory_db}"
USER="${POSTGRES_USER:-admin}"
PASS="${POSTGRES_PASSWORD:-securepassword}"

echo "[backup] dumping DB=${DB} USER=${USER} -> backups/"

docker compose exec -T -e PGPASSWORD="$PASS" db \
  pg_dump -U "$USER" -d "$DB" --format=custom --no-owner --no-acl \
  > "backups/inventory_db_${TS}.dump"

docker compose exec -T -e PGPASSWORD="$PASS" db \
  pg_dump -U "$USER" -d "$DB" --format=plain --no-owner --no-acl \
  > "backups/inventory_db_${TS}.sql"

ls -lh "backups/inventory_db_${TS}.dump" "backups/inventory_db_${TS}.sql"
echo "[backup] ✅ done"
