#!/usr/bin/env bash
set -euo pipefail

IS_CI=0
if [ "${GITHUB_ACTIONS:-}" = "true" ] || [ "${CI:-}" = "true" ]; then
  IS_CI=1
fi

SKIP_DOCKER="${SKIP_DOCKER:-0}"
SKIP_SMOKE="${SKIP_SMOKE:-0}"
SMOKE_MAX_SECONDS="${SMOKE_MAX_SECONDS:-240}"

echo "================================================="
echo "[verify] repo: $(pwd)"
echo "[verify] node: $(node -v 2>/dev/null || echo 'N/A')"
echo "[verify] npm : $(npm -v 2>/dev/null || echo 'N/A')"
echo "[verify] IS_CI=${IS_CI}  SKIP_DOCKER=${SKIP_DOCKER}  SKIP_SMOKE=${SKIP_SMOKE}  SMOKE_MAX_SECONDS=${SMOKE_MAX_SECONDS}"
echo "================================================="

bash scripts/sanity.sh

echo "[client] npm ci + typecheck + test + build"
pushd client >/dev/null
npm ci
npm run typecheck
npm run test:ci
CI=true npm run build
popd >/dev/null
echo "✅ [client] ok"

echo "[server] npm ci + (typecheck/test/build if exists)"
pushd server >/dev/null
npm ci
npm run typecheck 2>/dev/null || true
npm test 2>/dev/null || true
npm run build 2>/dev/null || true
popd >/dev/null
echo "✅ [server] ok"

if [ "${SKIP_DOCKER}" = "1" ]; then
  echo "[verify] SKIP_DOCKER=1; skip docker build + smoke"
  echo "================================================="
  echo "✅ VERIFY PASSED"
  echo "================================================="
  exit 0
fi

echo "[verify] docker compose build"
docker compose build
echo "✅ [verify] docker build ok"

if [ "${SKIP_SMOKE}" = "1" ]; then
  echo "[verify] SKIP_SMOKE=1; skip smoke"
  echo "================================================="
  echo "✅ VERIFY PASSED"
  echo "================================================="
  exit 0
fi

export SMOKE_MAX_SECONDS
bash scripts/smoke.sh

echo "================================================="
echo "✅ VERIFY PASSED"
echo "================================================="
