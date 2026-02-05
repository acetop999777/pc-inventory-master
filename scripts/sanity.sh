#!/usr/bin/env bash
set -euo pipefail

echo "[sanity] scanning for shell/paste pollution inside TS/TSX..."

if command -v rg >/dev/null 2>&1; then
  files="$(rg --files -g 'client/src/**/*.ts' -g 'client/src/**/*.tsx' 2>/dev/null || true)"
else
  files="$(find client/src -type f \( -name '*.ts' -o -name '*.tsx' \) 2>/dev/null || true)"
fi
if [ -z "${files}" ]; then
  echo "[sanity] no TS/TSX files found; skip"
  echo "✅ [sanity] ok"
  exit 0
fi

pattern='(^admin@|^iceace@|^[^[:space:]]+@[^[:space:]]+[: ].*\$|^\$ |^remote: |^fatal: |^error: failed to push|^Enumerating objects:|^Counting objects:|^Delta compression|^Compressing objects:|^Writing objects:|^To https?://github\.com/|^git@github\.com:)'

if command -v rg >/dev/null 2>&1; then
  if rg -n -S -e "${pattern}" ${files}; then
    echo "[sanity] ❌ suspicious terminal/shell paste detected in TS/TSX"
    exit 1
  fi
else
  if grep -nE "${pattern}" ${files}; then
    echo "[sanity] ❌ suspicious terminal/shell paste detected in TS/TSX"
    exit 1
  fi
fi

echo "✅ [sanity] ok"
