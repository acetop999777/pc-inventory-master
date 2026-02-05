#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${API_BASE:-http://localhost:5001/api}"
DB_USER="${POSTGRES_USER:-admin}"
DB_NAME="${POSTGRES_DB:-inventory_db}"

pass() {
  echo "PASS: $1"
}

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

http_get() {
  local url="$1"
  curl -sS -w "\n%{http_code}" "$url"
}

http_post() {
  local url="$1"
  local json="$2"
  curl -sS -w "\n%{http_code}" -H "Content-Type: application/json" -d "$json" "$url"
}

uuid() {
  python - <<'PY'
import uuid; print(uuid.uuid4())
PY
}

# 1) health
resp=$(http_get "$BASE_URL/health")
body=$(echo "$resp" | sed '$d')
code=$(echo "$resp" | tail -n1)
if [ "$code" != "200" ]; then
  fail "health check failed (status $code)"
fi
pass "health check"

# 2) inventory read
resp=$(http_get "$BASE_URL/inventory")
body=$(echo "$resp" | sed '$d')
code=$(echo "$resp" | tail -n1)
if [ "$code" != "200" ]; then
  fail "inventory read failed (status $code)"
fi
pass "inventory read"

# 3) write success (inventory batch)
TS=$(date +%s)
OP_ID=$(uuid)
INV_ID="smoke_inv_${TS}"

payload=$(cat <<JSON
{"operationId":"$OP_ID","items":[{"id":"$INV_ID","name":"Smoke CPU","category":"CPU","qtyDelta":2,"unitCost":123.45}]}
JSON
)

resp=$(http_post "$BASE_URL/inventory/batch" "$payload")
body=$(echo "$resp" | sed '$d')
code=$(echo "$resp" | tail -n1)
if [ "$code" != "200" ]; then
  fail "inventory batch failed (status $code)"
fi
pass "inventory batch write"

# 4) movements consistency check (if db container available)
COUNT_BEFORE=""
if command -v docker >/dev/null 2>&1 && [ -f docker-compose.yml ]; then
  if docker compose ps -q db >/dev/null 2>&1; then
    COUNT_BEFORE=$(docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT COUNT(*) FROM inventory_movements WHERE inventory_id='$INV_ID';" | tr -d '[:space:]')
    if [ -z "$COUNT_BEFORE" ]; then
      fail "movement count query failed"
    fi
    if [ "$COUNT_BEFORE" -lt 1 ]; then
      fail "movement row missing"
    fi
    CHECK=$(docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT m.on_hand_after, m.avg_cost_after, i.quantity, i.cost FROM inventory_movements m JOIN inventory i ON i.id=m.inventory_id WHERE m.inventory_id='$INV_ID' ORDER BY m.id DESC LIMIT 1;" | tr -d '[:space:]')
    IFS='|' read -r MOV_QTY MOV_COST INV_QTY INV_COST <<< "$CHECK"
    if [ -z "$MOV_QTY" ] || [ -z "$INV_QTY" ]; then
      fail "movement snapshot query failed"
    fi
    if [ "$MOV_QTY" != "$INV_QTY" ]; then
      fail "movement on_hand_after mismatch"
    fi
    if [ "$MOV_COST" != "$INV_COST" ]; then
      fail "movement avg_cost_after mismatch"
    fi
pass "movement snapshot matches inventory"
  else
    echo "SKIP: db container not running; movement check skipped"
  fi
else
  echo "SKIP: docker compose not available; movement check skipped"
fi

# 5) idempotency: repeat same operationId should not double-apply
resp=$(http_post "$BASE_URL/inventory/batch" "$payload")
body2=$(echo "$resp" | sed '$d')
code2=$(echo "$resp" | tail -n1)
if [ "$code2" != "200" ]; then
  fail "idempotent replay failed (status $code2)"
fi
pass "idempotent replay"

if [ -n "$COUNT_BEFORE" ]; then
  COUNT_AFTER=$(docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT COUNT(*) FROM inventory_movements WHERE inventory_id='$INV_ID';" | tr -d '[:space:]')
  if [ "$COUNT_AFTER" != "$COUNT_BEFORE" ]; then
    fail "movement count changed on idempotent replay"
  fi
pass "movement idempotency"
fi

# 6) failure path (inventory insufficient) must return error contract
OP_FAIL=$(uuid)
FAIL_PAYLOAD=$(cat <<JSON
{"operationId":"$OP_FAIL","items":[{"id":"$INV_ID","qtyDelta":-999,"unitCost":1}]}
JSON
)
resp=$(http_post "$BASE_URL/inventory/batch" "$FAIL_PAYLOAD")
body=$(echo "$resp" | sed '$d')
code=$(echo "$resp" | tail -n1)
if [ "$code" == "200" ]; then
  fail "expected error but got success"
fi
python - <<PY
import json,sys
body = '''$body'''
try:
  data = json.loads(body)
except Exception as e:
  print('FAIL: error response not json')
  sys.exit(1)
err = data.get('error') or {}
missing = [k for k in ('code','retryable','requestId') if k not in err]
if missing:
  print('FAIL: error contract missing fields:', ','.join(missing))
  sys.exit(1)
print('PASS: error contract')
PY

# 7) receipt create (2 items) + idempotency + movement linkage
REC_OP=$(uuid)
REC_PAYLOAD=$(cat <<JSON
{
  "operationId": "$REC_OP",
  "receivedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "vendor": "SmokeVendor",
  "mode": "MANUAL",
  "notes": "smoke receipt",
  "items": [
    { "inventoryId": "$INV_ID", "qty": 1, "unitCost": 10.5 },
    { "inventoryId": "$INV_ID", "qty": 2, "unitCost": 20 }
  ]
}
JSON
)

resp=$(http_post "$BASE_URL/inbound/receipts" "$REC_PAYLOAD")
body=$(echo "$resp" | sed '$d')
code=$(echo "$resp" | tail -n1)
if [ "$code" != "200" ]; then
  fail "receipt create failed (status $code)"
fi
pass "receipt create"

REC_ID=$(python - <<PY
import json
data = json.loads('''$body''')
print(data.get('receipt', {}).get('id', ''))
PY
)
if [ -z "$REC_ID" ]; then
  fail "receipt id missing"
fi

if command -v docker >/dev/null 2>&1 && [ -f docker-compose.yml ]; then
  if docker compose ps -q db >/dev/null 2>&1; then
    REC_COUNT=$(docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT COUNT(*) FROM inbound_receipts WHERE id=$REC_ID;" | tr -d '[:space:]')
    ITEM_COUNT=$(docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT COUNT(*) FROM inbound_receipt_items WHERE receipt_id=$REC_ID;" | tr -d '[:space:]')
    if [ "$REC_COUNT" != "1" ]; then
      fail "receipt row missing"
    fi
    if [ "$ITEM_COUNT" -lt 1 ]; then
      fail "receipt items missing"
    fi
    MOVE_COUNT=$(docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT COUNT(*) FROM inventory_movements WHERE ref_type='RECEIPT' AND ref_id='$REC_ID';" | tr -d '[:space:]')
    if [ "$MOVE_COUNT" -lt 1 ]; then
      fail "receipt movements missing"
    fi
    pass "receipt db rows"
  fi
fi

resp=$(http_post "$BASE_URL/inbound/receipts" "$REC_PAYLOAD")
body=$(echo "$resp" | sed '$d')
code=$(echo "$resp" | tail -n1)
if [ "$code" != "200" ]; then
  fail "receipt idempotent replay failed (status $code)"
fi
pass "receipt idempotent replay"

pass "verify_core completed"
