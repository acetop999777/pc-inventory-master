#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

set -a
[ -f ./.env ] && . ./.env
set +a

DUMP="${1:-}"
if [[ -z "$DUMP" ]]; then
  echo "Usage: ./scripts/db_restore.sh backups/xxx.dump"
  exit 1
fi
if [[ ! -f "$DUMP" ]]; then
  echo "[restore] ERROR: file not found: $DUMP"
  exit 1
fi

DB="${POSTGRES_DB:-inventory_db}"
USER="${POSTGRES_USER:-admin}"
PASS="${POSTGRES_PASSWORD:-securepassword}"

echo "[restore] WARNING: this will DROP and recreate schema in ${DB}"
echo "[restore] restoring from: $DUMP"

DBCID="$(docker compose ps -q db)"
echo "[restore] db container: $DBCID"

TMP="/tmp/restore_$(date +%s).dump"
docker cp "$DUMP" "${DBCID}:${TMP}"

docker compose exec -T -e PGPASSWORD="$PASS" db psql -U "$USER" -d "$DB" -v ON_ERROR_STOP=1 -c \
"DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"

docker compose exec -T -e PGPASSWORD="$PASS" db pg_restore -U "$USER" -d "$DB" --no-owner --no-acl "$TMP"
docker compose exec -T db sh -lc "rm -f '$TMP'"

echo "[restore] ✅ restore finished"

# restart server (if present)
if docker compose ps -q server >/dev/null 2>&1; then
  docker compose restart server >/dev/null 2>&1 || true
  echo "[restore] ✅ server restarted (if present)"
fi
