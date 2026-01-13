#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: scripts/db_restore.sh backups/<file>.dump"
  exit 1
fi

FILE="$1"
if [ ! -f "$FILE" ]; then
  echo "File not found: $FILE"
  exit 1
fi

USER="${POSTGRES_USER:-admin}"
DB="${POSTGRES_DB:-inventory_db}"
PASS="${POSTGRES_PASSWORD:-securepassword}"

echo "[restore] WARNING: this will DROP and recreate schema in $DB"
echo "[restore] restoring from: $FILE"

docker compose exec -T -e PGPASSWORD="$PASS" db \
  psql -U "$USER" -d "$DB" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

docker compose exec -T -e PGPASSWORD="$PASS" db \
  pg_restore -U "$USER" -d "$DB" --no-owner --no-acl "$FILE"

echo "[restore] restarting server to re-run init/migrations safely..."
docker compose restart server >/dev/null

echo "[restore] ✅ done"
