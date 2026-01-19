#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/server"

echo "[server] node: $(node -v)"
echo "[server] npm : $(npm -v)"

if [ -f package-lock.json ]; then
  echo "[server] npm ci"
  npm ci
else
  echo "[server] npm install (no package-lock.json)"
  npm install
fi

# 服务器未必有这些脚本：全部用 --if-present 防御
echo "[server] typecheck"
npm run typecheck --if-present
echo "[server] tests"
npm test --if-present
echo "[server] build"
npm run build --if-present
echo "✅ [server] ok"
