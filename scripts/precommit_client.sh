#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

# 只拿 staged（准备提交）的新增/修改文件
STAGED="$(git diff --cached --name-only --diff-filter=ACM | tr -d '\r' || true)"

# 只处理 client 下这些后缀
CLIENT_FILES="$(echo "$STAGED" | grep '^client/' | grep -E '\.(ts|tsx|js|jsx|json|css|md)$' || true)"
if [ -z "$CLIENT_FILES" ]; then
  exit 0
fi

echo "[pre-commit] formatting/linting staged client files:"
echo "$CLIENT_FILES"

# 变成 client 目录下的相对路径
REL_FILES="$(echo "$CLIENT_FILES" | sed 's#^client/##')"
REL_CODE="$(echo "$REL_FILES" | grep -E '\.(ts|tsx|js|jsx)$' || true)"

cd "$ROOT/client"

# prettier：所有支持的文件
echo "$REL_FILES" | xargs -r npx prettier --write

# eslint：只跑代码文件
if [ -n "$REL_CODE" ]; then
  echo "$REL_CODE" | xargs -r npx eslint --fix --max-warnings=0
fi

cd "$ROOT"

# 把被自动修复的文件重新 add 回 index
echo "$CLIENT_FILES" | xargs -r git add

echo "[pre-commit] ✅ done"
