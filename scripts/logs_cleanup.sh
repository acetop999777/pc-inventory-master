#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DB_NAME="${POSTGRES_DB:-inventory_db}"
DB_USER="${POSTGRES_USER:-admin}"
RETENTION_DAYS="${LOG_RETENTION_DAYS:-90}"

if ! [[ "${RETENTION_DAYS}" =~ ^[0-9]+$ ]]; then
  echo "[logs-cleanup] ❌ LOG_RETENTION_DAYS must be a positive integer"
  exit 1
fi

if [ "${RETENTION_DAYS}" -lt 7 ]; then
  echo "[logs-cleanup] ❌ LOG_RETENTION_DAYS too small (${RETENTION_DAYS}); minimum is 7"
  exit 1
fi

cutoff_ms="$(( $(date +%s) * 1000 - RETENTION_DAYS * 86400 * 1000 ))"

echo "[logs-cleanup] DB=${DB_NAME} USER=${DB_USER} retention=${RETENTION_DAYS}d cutoff_ms=${cutoff_ms}"

docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" \
  -v cutoff_ms="${cutoff_ms}" \
  -c "DELETE FROM logs WHERE timestamp < :cutoff_ms;"

echo "[logs-cleanup] ✅ done"
