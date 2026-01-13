#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

set -a
[ -f ./.env ] && . ./.env
set +a

SERVER_URL="${SERVER_URL:-http://127.0.0.1:${SERVER_PORT:-5001}}"
CLIENT_URL="${CLIENT_URL:-http://127.0.0.1:${CLIENT_PORT:-8090}}"
SMOKE_BACKUP="${SMOKE_BACKUP:-true}"

health="${SERVER_URL}/api/health"

echo "[smoke] waiting server health: ${health} (max 60s)"
deadline=$((SECONDS+60))
while true; do
  if out="$(curl -sS "${health}" 2>/dev/null)"; then
    if echo "$out" | grep -q '"ok":true'; then
      echo "[smoke] server ready ✅ $out"
      break
    fi
  fi
  if (( SECONDS >= deadline )); then
    echo "[smoke] ❌ server not healthy within 60s"
    exit 1
  fi
  sleep 1
done

echo "[smoke] GET ${SERVER_URL}/api/clients (head)"
curl -sS "${SERVER_URL}/api/clients" | head -c 200 || true
echo

echo "[smoke] GET ${SERVER_URL}/api/inventory (head)"
curl -sS "${SERVER_URL}/api/inventory" | head -c 200 || true
echo

echo "[smoke] GET ${CLIENT_URL}/ (head)"
curl -sS "${CLIENT_URL}/" | head -c 200 || true
echo

echo "[smoke] ✅ passed"

if [[ "${SMOKE_BACKUP}" == "true" ]]; then
  ./scripts/db_backup.sh
  ./scripts/backup_rotate.sh
fi
