#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "================================================="
echo "[quickcheck] repo: ${ROOT}"
echo "================================================="

echo "[client] typecheck + tests"
pushd "${ROOT}/client" >/dev/null
npm run typecheck
npm run test:ci
popd >/dev/null

echo "[server] typecheck (if script exists)"
pushd "${ROOT}/server" >/dev/null
if npm run | rg -q "typecheck"; then
  npm run typecheck
fi
popd >/dev/null

echo "✅ [quickcheck] ok"
