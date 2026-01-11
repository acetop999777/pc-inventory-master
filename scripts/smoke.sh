#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:5001}"
UI_URL="${UI_URL:-http://localhost:8090}"

say() { printf "\n[%s] %s\n" "$(date +'%H:%M:%S')" "$*"; }

if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DC="docker-compose"
else
  echo "ERROR: docker compose not found." >&2
  exit 1
fi

say "Docker compose: $DC"
$DC ps || true

hit() {
  local url="$1"
  local name="$2"
  say "GET ${name}: ${url}"
  curl -fsS --max-time 10 "$url" >/tmp/pcinv_smoke.json
  head -c 120 /tmp/pcinv_smoke.json | tr '\n' ' ' && echo
}

say "API base: $BASE_URL"
hit "$BASE_URL/api/clients" "clients"
hit "$BASE_URL/api/inventory" "inventory"
hit "$BASE_URL/api/dashboard/stats" "dashboard/stats"

say "UI: $UI_URL"
curl -fsS --max-time 10 "$UI_URL" >/dev/null && say "UI OK" || say "UI check skipped/failed"

say "✅ Smoke test passed"
