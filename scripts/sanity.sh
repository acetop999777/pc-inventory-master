#!/usr/bin/env bash
set -euo pipefail

echo "[sanity] scanning for shell/paste pollution inside TS/TSX..."
# 这些前缀一旦出现在 ts/tsx 里，99% 是误粘贴
PATTERN='^(cd |bash |mv |sed |rg |cat |npm |git )'

if rg -n --glob 'client/src/**/*.{ts,tsx}' "$PATTERN" client/src; then
  echo "❌ Found shell-ish lines inside TS/TSX. Fix before continuing."
  exit 1
fi

echo "✅ [sanity] ok"
