#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SERVER_PORT="${SERVER_PORT:-5001}"
CLIENT_PORT="${CLIENT_PORT:-8090}"

HEALTH_URL="http://127.0.0.1:${SERVER_PORT}/api/health"
CLIENT_URL="http://127.0.0.1:${CLIENT_PORT}/"

echo "[smoke] waiting server health: ${HEALTH_URL} (max 60s)"

ok=0
for i in $(seq 1 60); do
  if curl -fsS "$HEALTH_URL" >/tmp/health.json 2>/dev/null; then
    ok=1
    break
  fi
  sleep 1
done

if [[ "$ok" -ne 1 ]]; then
  echo "[smoke] ❌ server not healthy within 60s"
  exit 1
fi

echo -n "[smoke] server ready ✅ "
cat /tmp/health.json
echo

echo "[smoke] GET http://127.0.0.1:${SERVER_PORT}/api/clients (head)"
curl -fsS "http://127.0.0.1:${SERVER_PORT}/api/clients" | head -c 180 || true
echo

# Phase 8.3: clients error codes (NOT_FOUND + VALIDATION_FAILED)
echo "[smoke] clients error: GET /api/clients/__nope__ expects 404 NOT_FOUND"
status=$(curl -sS -o /tmp/clients_404.json -w "%{http_code}" "http://127.0.0.1:${SERVER_PORT}/api/clients/__nope__" || true)
if [[ "$status" != "404" ]]; then
  echo "[smoke] ❌ expected 404, got $status"
  cat /tmp/clients_404.json || true
  exit 1
fi
grep -q '"code"\s*:\s*"NOT_FOUND"' /tmp/clients_404.json || { echo "[smoke] ❌ missing NOT_FOUND code"; cat /tmp/clients_404.json; exit 1; }
echo "[smoke] ✅ 404 NOT_FOUND OK"

echo "[smoke] clients validation: POST /api/clients expects 400 VALIDATION_FAILED"
status=$(curl -sS -o /tmp/clients_400.json -w "%{http_code}" \
  -H "Content-Type: application/json" \
  -d '{}' \
  "http://127.0.0.1:${SERVER_PORT}/api/clients" || true)
if [[ "$status" != "400" ]]; then
  echo "[smoke] ❌ expected 400, got $status"
  cat /tmp/clients_400.json || true
  exit 1
fi
grep -q '"code"\s*:\s*"VALIDATION_FAILED"' /tmp/clients_400.json || { echo "[smoke] ❌ missing VALIDATION_FAILED code"; cat /tmp/clients_400.json; exit 1; }
grep -q '"fields"' /tmp/clients_400.json || { echo "[smoke] ❌ missing validation details.fields"; cat /tmp/clients_400.json; exit 1; }
echo "[smoke] ✅ 400 VALIDATION_FAILED OK"

echo "[smoke] GET http://127.0.0.1:${SERVER_PORT}/api/inventory (head)"
curl -fsS "http://127.0.0.1:${SERVER_PORT}/api/inventory" | head -c 180 || true
echo

echo "[smoke] GET ${CLIENT_URL} (head)"
curl -fsS "$CLIENT_URL" | head -c 180 || true
echo

echo "[smoke] ✅ passed"

# backup + rotate
./scripts/db_backup.sh
./scripts/backup_rotate.sh
