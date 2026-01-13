#!/usr/bin/env bash
set -euo pipefail

API="${API:-http://127.0.0.1:5001}"
UI="${UI:-http://127.0.0.1:8090}"

echo "[smoke] GET $API/api/health"
curl -fsS "$API/api/health" | sed 's/.*/[ok] &/'

echo "[smoke] GET $API/api/clients (head)"
curl -fsS "$API/api/clients" | head -c 200; echo

echo "[smoke] GET $API/api/inventory (head)"
curl -fsS "$API/api/inventory" | head -c 200; echo

echo "[smoke] GET $UI/ (head)"
curl -fsS "$UI/" | head -c 200; echo

echo "[smoke] ✅ passed"
