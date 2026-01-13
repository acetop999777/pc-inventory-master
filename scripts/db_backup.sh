#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DB_NAME="${POSTGRES_DB:-inventory_db}"
DB_USER="${POSTGRES_USER:-admin}"

TS="$(date +%Y%m%d_%H%M%S)"
OUT_DUMP="backups/${DB_NAME}_${TS}.dump"
OUT_SQL="backups/${DB_NAME}_${TS}.sql"

echo "[backup] dumping DB=${DB_NAME} USER=${DB_USER} -> backups/"

docker compose exec -T db pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc > "$OUT_DUMP"
docker compose exec -T db pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --no-privileges > "$OUT_SQL"

ls -lh "$OUT_DUMP" "$OUT_SQL"
echo "[backup] ✅ done"
