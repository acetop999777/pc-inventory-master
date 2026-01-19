#!/usr/bin/env bash
set -euo pipefail

HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:5001/api/health}"
SMOKE_TIMEOUT_SEC="${SMOKE_TIMEOUT_SEC:-60}"
SLEEP_SEC="${SLEEP_SEC:-2}"

echo "[smoke] ensuring services up (docker compose up -d)"
docker compose up -d --remove-orphans

echo "[smoke] waiting server health: ${HEALTH_URL} (max ${SMOKE_TIMEOUT_SEC}s)"

max_tries=$(( (SMOKE_TIMEOUT_SEC + SLEEP_SEC - 1) / SLEEP_SEC ))
ready=0
last_body=""

for i in $(seq 1 "$max_tries"); do
  if last_body="$(curl -fsS "$HEALTH_URL" 2>/dev/null)"; then
    ready=1
    break
  fi
  sleep "$SLEEP_SEC"
done

if [ "$ready" -ne 1 ]; then
  echo "[smoke] ❌ server not healthy within ${SMOKE_TIMEOUT_SEC}s"

  echo "[smoke] docker compose ps"
  docker compose ps || true

  echo "[smoke] docker compose logs (tail=200)"
  docker compose logs --no-color --tail=200 server db client || true

  echo "[smoke] last curl attempt (best-effort)"
  curl -v "$HEALTH_URL" || true

  exit 1
fi

echo "[smoke] server ready ✅ ${last_body}"

head_out() {
  local url="$1"
  local n="${2:-220}"
  local body
  body="$(curl -fsS "$url")"
  echo "[smoke] GET ${url} (head)"
  echo "${body}" | head -c "$n"
  echo
}

expect_status_and_contains() {
  local method="$1"
  local url="$2"
  local want_code="$3"
  local want_sub="$4"
  local data="${5:-}"

  local tmp
  tmp="$(mktemp)"

  local code="000"
  if [ "$method" = "GET" ]; then
    code="$(curl -sS -o "$tmp" -w "%{http_code}" "$url" || true)"
  else
    code="$(curl -sS -o "$tmp" -w "%{http_code}" \
      -X "$method" -H "Content-Type: application/json" \
      -d "$data" "$url" || true)"
  fi

  local body
  body="$(cat "$tmp" || true)"
  rm -f "$tmp" || true

  if [ "$code" = "$want_code" ] && echo "$body" | grep -q "$want_sub"; then
    echo "[smoke] ✅ ${want_code} ${want_sub} OK"
    return 0
  fi

  echo "[smoke] ❌ expected ${want_code} and contains '${want_sub}', got ${code}"
  echo "[smoke] body:"
  echo "$body"
  return 1
}

# ---- your existing smoke checks ----
head_out "http://127.0.0.1:5001/api/clients" 220
expect_status_and_contains "GET"  "http://127.0.0.1:5001/api/clients/__nope__" "404" "NOT_FOUND"
expect_status_and_contains "POST" "http://127.0.0.1:5001/api/clients"          "400" "VALIDATION_FAILED" "{}"
head_out "http://127.0.0.1:5001/api/inventory" 220

echo "[smoke] GET http://127.0.0.1:8090/ (head)"
html="$(curl -fsS "http://127.0.0.1:8090/")"
echo "$html" | head -c 220
echo
echo "$html" | grep -qi "PC Inventory Master"

echo "[smoke] ✅ passed"
