#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/client"

echo "[client] node: $(node -v)"
echo "[client] npm : $(npm -v)"

if [ -f package-lock.json ]; then
  echo "[client] npm ci"
  npm ci
else
  echo "[client] npm install (no package-lock.json)"
  npm install
fi

echo "[client] typecheck"
npm run typecheck --if-present

echo "[client] tests"
npm run test:ci --if-present
echo "[client] build"
npm run build

echo "✅ [client] ok"
