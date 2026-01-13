#!/usr/bin/env bash
set -euo pipefail

USER="${POSTGRES_USER:-admin}"
DB="${POSTGRES_DB:-inventory_db}"
PASS="${POSTGRES_PASSWORD:-securepassword}"

echo "[seed] applying server/db/seed.sql -> $DB"
docker compose exec -T -e PGPASSWORD="$PASS" db \
  psql -U "$USER" -d "$DB" -v ON_ERROR_STOP=1 \
  < server/db/seed.sql

echo "[seed] restarting server (optional, but helps ensure API sees new data immediately)"
docker compose restart server >/dev/null

echo "[seed] ✅ done"
