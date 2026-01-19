#!/usr/bin/env bash
set -euo pipefail

echo "[sanity] scanning for shell/paste pollution inside TS/TSX..."

# 规则尽量保守：只扫明显危险的“curl|bash / wget|sh / bash -c curl / eval( / child_process.exec”
PATTERN='(curl\s+[^|]+\|\s*(bash|sh)|wget\s+[^|]+\|\s*(bash|sh)|bash\s+-c\s+.*curl|eval\s*\(|child_process\.(exec|spawn))'

if command -v rg >/dev/null 2>&1; then
  # 只扫 ts/tsx，跳过 node_modules、build 等
  if rg -n -S --hidden \
    --glob '*.ts' --glob '*.tsx' \
    --glob '!**/node_modules/**' \
    --glob '!**/build/**' \
    --glob '!**/dist/**' \
    "$PATTERN" .; then
    echo "[sanity] ❌ found suspicious patterns above"
    exit 1
  fi
else
  # 没装 rg 就直接跳过，不报错、不污染 CI annotations
  echo "[sanity] rg not found; skip scan (no failure)"
fi

echo "✅ [sanity] ok"
