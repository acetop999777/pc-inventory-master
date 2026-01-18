#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "================================================="
echo "[verify] repo: $ROOT"
echo "[verify] node: $(node -v 2>/dev/null || echo 'missing')"
echo "[verify] npm : $(npm -v 2>/dev/null || echo 'missing')"
echo "[verify] SKIP_DOCKER=${SKIP_DOCKER:-0}  SKIP_SMOKE=${SKIP_SMOKE:-0}"
echo "================================================="

if [ -d client ]; then
  bash scripts/verify_client.sh
else
  echo "[verify] skip: ./client not found"
fi

if [ -d server ]; then
  bash scripts/verify_server.sh
else
  echo "[verify] skip: ./server not found"
fi

if [ "${SKIP_DOCKER:-0}" != "1" ]; then
  if command -v docker >/dev/null 2>&1; then
    if [ -f docker-compose.yml ] || [ -f docker-compose.yaml ] || [ -f compose.yaml ]; then
      echo "[verify] docker compose build"
      docker compose build
      echo "✅ [verify] docker build ok"
    else
      echo "[verify] skip docker: no compose file"
    fi
  else
    echo "[verify] skip docker: docker not installed"
  fi
else
  echo "[verify] skip docker (SKIP_DOCKER=1)"
fi

if [ "${SKIP_SMOKE:-0}" != "1" ]; then
  if [ -f scripts/smoke.sh ]; then
    echo "[verify] smoke"
    bash scripts/smoke.sh
    echo "✅ [verify] smoke ok"
  else
    echo "[verify] skip smoke: scripts/smoke.sh not found"
  fi
else
  echo "[verify] skip smoke (SKIP_SMOKE=1)"
fi

echo "================================================="
echo "✅ VERIFY PASSED"
echo "================================================="
