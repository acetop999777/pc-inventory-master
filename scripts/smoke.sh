#!/usr/bin/env bash
set -euo pipefail

COMPOSE="${COMPOSE_CMD:-docker compose}"
SERVER_BASE="${SMOKE_SERVER_BASE_URL:-http://127.0.0.1:5001}"
HEALTH_URL="${SMOKE_HEALTH_URL:-${SERVER_BASE}/api/health}"
CLIENT_URL="${SMOKE_CLIENT_URL:-http://127.0.0.1:8090/}"

MAX_SECONDS="${SMOKE_MAX_SECONDS:-240}"
SLEEP_SECONDS="${SMOKE_SLEEP_SECONDS:-2}"

echo "[smoke] ensuring services up (docker compose up -d)"
${COMPOSE} up -d

echo "[smoke] waiting server health: ${HEALTH_URL} (max ${MAX_SECONDS}s)"
deadline=$(( $(date +%s) + MAX_SECONDS ))

while true; do
  if curl -fsS --max-time 5 "${HEALTH_URL}" >/tmp/smoke_health.json 2>/tmp/smoke_health.err; then
    echo "[smoke] server ready ✅ $(cat /tmp/smoke_health.json)"
    break
  fi

  if [ "$(date +%s)" -ge "${deadline}" ]; then
    echo "[smoke] ❌ server not healthy within ${MAX_SECONDS}s"
    echo "[smoke] ---- docker compose ps ----"
    ${COMPOSE} ps || true
    echo "[smoke] ---- docker compose logs (server/db) ----"
    ${COMPOSE} logs --no-color --tail=300 server db || true
    exit 1
  fi

  sleep "${SLEEP_SECONDS}"
done

head_json() {
  local url="$1"
  echo "[smoke] GET ${url} (head)"
  # 用 range 避免 curl|head 触发 SIGPIPE -> curl(23)
  curl -fsS --max-time 10 --range 0-299 "${url}" || true
  echo
}

expect_status() {
  local url="$1"
  local expected="$2"
  local label="$3"

  local body_file="/tmp/smoke_body.$$"
  local code
  code="$(curl -sS --max-time 15 -o "${body_file}" -w "%{http_code}" "${url}" || true)"

  if [ "${code}" != "${expected}" ]; then
    echo "[smoke] ❌ ${label}: expected ${expected}, got ${code}"
    echo "[smoke] ---- body ----"
    head -c 800 "${body_file}" || true
    rm -f "${body_file}" || true
    exit 1
  fi

  echo "[smoke] ✅ ${label} OK"
  rm -f "${body_file}" || true
}

head_json "${SERVER_BASE}/api/clients"
expect_status "${SERVER_BASE}/api/clients/__nope__" "404" "clients error: expects 404"
expect_status "${SERVER_BASE}/api/clients" "200" "clients ok: expects 200"
head_json "${SERVER_BASE}/api/inventory"
head_json "${CLIENT_URL}"

echo "[smoke] ✅ passed"
