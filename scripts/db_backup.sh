#!/usr/bin/env bash
set -euo pipefail
mkdir -p backups
TS="$(date +%Y%m%d_%H%M%S)"

USER="${POSTGRES_USER:-admin}"
DB="${POSTGRES_DB:-inventory_db}"
PASS="${POSTGRES_PASSWORD:-securepassword}"

echo "[backup] dumping DB=$DB USER=$USER -> backups/"
docker compose exec -T -e PGPASSWORD="$PASS" db \
  pg_dump -U "$USER" -d "$DB" --format=custom --no-owner --no-acl \
  > "backups/${DB}_${TS}.dump"

docker compose exec -T -e PGPASSWORD="$PASS" db \
  pg_dump -U "$USER" -d "$DB" --format=plain --no-owner --no-acl \
  > "backups/${DB}_${TS}.sql"

ls -lh "backups/${DB}_${TS}.dump" "backups/${DB}_${TS}.sql"
echo "[backup] ✅ done"
