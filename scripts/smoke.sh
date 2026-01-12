#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:5001}"
UI_URL="${UI_URL:-http://127.0.0.1:8090}"

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

wait_api() {
  local url="$1"
  local attempts="${2:-40}"
  local delay="${3:-0.5}"

  say "Waiting for API to be ready: ${url}"
  for i in $(seq 1 "$attempts"); do
    if curl -fsS --max-time 2 "$url" >/dev/null 2>&1; then
      say "API ready"
      return 0
    fi
    sleep "$delay"
  done

  echo
  echo "[smoke] API not ready after ${attempts} attempts. Showing server logs:" >&2
  $DC logs --tail=200 server || true
  echo
  echo "[smoke] Showing db logs:" >&2
  $DC logs --tail=120 db || true
  return 1
}

hit_ok() {
  local url="$1"
  local name="$2"
  say "GET ${name}: ${url}"
  curl -fsS --max-time 10 "$url" >/tmp/pcinv_smoke.json
  head -c 120 /tmp/pcinv_smoke.json | tr '\n' ' ' && echo
}

req() {
  local method="$1"
  local url="$2"
  local data="${3:-}"
  rm -f /tmp/pcinv_body /tmp/pcinv_hdr
  if [[ -n "$data" ]]; then
    code="$(curl -sS --max-time 10 -X "$method" -H 'Content-Type: application/json' \
      -d "$data" -D /tmp/pcinv_hdr -o /tmp/pcinv_body -w '%{http_code}' "$url")"
  else
    code="$(curl -sS --max-time 10 -X "$method" \
      -D /tmp/pcinv_hdr -o /tmp/pcinv_body -w '%{http_code}' "$url")"
  fi
  echo "$code"
}

# assert_error_contract expected_status expected_code [expect_field_path] [expect_retryable]
assert_error_contract() {
  local expected_status="$1"
  local expected_code="$2"
  local expect_field_path="${3:-}"
  local expect_retryable="${4:-}"

  python3 - <<PY
import json, sys
body = open('/tmp/pcinv_body','r',encoding='utf-8').read().strip()
hdr  = open('/tmp/pcinv_hdr','r',encoding='utf-8',errors='ignore').read().lower()

j = json.loads(body)
err = j.get('error') or {}
code = err.get('code')
rid  = err.get('requestId')

assert code == "${expected_code}", f"expected code ${expected_code}, got {code}"
assert rid and isinstance(rid, str), f"missing requestId in body: {err}"
assert 'x-request-id:' in hdr, "missing x-request-id header"

if "${expect_retryable}":
  v = err.get('retryable')
  assert isinstance(v, bool), f"missing/invalid retryable: {v}"
  exp = True if "${expect_retryable}".lower() == 'true' else False
  assert v == exp, f"expected retryable={exp}, got {v}"

if "${expect_field_path}":
  fields = (err.get('details') or {}).get('fields') or []
  paths = [f.get('path') for f in fields if isinstance(f, dict)]
  assert "${expect_field_path}" in paths, f"expected field path '${expect_field_path}' in {paths}"

print("ok:", "${expected_status}", "${expected_code}", rid)
PY
}

say "API base: $BASE_URL"

# 等 API 起得来（否则直接打印 logs 并退出）
wait_api "$BASE_URL/api/clients" 60 0.5

hit_ok "$BASE_URL/api/clients" "clients"
hit_ok "$BASE_URL/api/inventory" "inventory"
hit_ok "$BASE_URL/api/dashboard/stats" "dashboard/stats"

say "Contract: 404 -> NOT_FOUND (retryable=false)"
code="$(req GET "$BASE_URL/api/__does_not_exist__")"
test "$code" = "404"
assert_error_contract "404" "NOT_FOUND" "" "false"

say "Contract: invalid POST /api/clients -> VALIDATION_FAILED (retryable=false)"
code="$(req POST "$BASE_URL/api/clients" '{"id":""}')"
test "$code" = "400"
assert_error_contract "400" "VALIDATION_FAILED" "id" "false"

say "UI: $UI_URL"
curl -fsS --max-time 10 "$UI_URL" >/dev/null && say "UI OK" || say "UI check skipped/failed"

say "✅ Smoke test passed"
