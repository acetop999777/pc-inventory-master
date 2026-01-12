set -euo pipefail
cd ~/pc-inventory-master

mkdir -p ops/patches

# 1) 探测 UI 根目录（你这边已经看到是在 presentation/components/ui）
if ls client/src/presentation/components/ui/FinancialCard.* >/dev/null 2>&1; then
  PREFIX='../../../../presentation/components/ui'
  echo "Using UI root: client/src/presentation/components/ui"
elif ls client/src/components/ui/FinancialCard.* >/dev/null 2>&1; then
  PREFIX='../../../../components/ui'
  echo "Using UI root: client/src/components/ui"
else
  echo "ERROR: cannot find FinancialCard.* under client/src/presentation/components/ui or client/src/components/ui"
  echo "Try: git ls-files | grep -i FinancialCard"
  exit 1
fi

# 2) 批量替换 features/clients/editor 下所有 ts/tsx/js/jsx 文件里的 import 路径
find client/src/features/clients/editor -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' \) -print0 \
  | xargs -0 perl -pi -e "s|\\Q../../../components/ui/\\E|$PREFIX/|g; s|\\Q../../../components/ui\\E'|$PREFIX'|g; s|\\Q../../../components/ui\\E\"|$PREFIX\"|g;"

# 3) 确认不再残留旧路径（有输出就说明还有漏网之鱼）
echo "Remaining matches (should be empty):"
grep -RIn "../../../components/ui" client/src/features/clients/editor || true

# 4) 记录补丁
git diff > ops/patches/phase6_2_1_fix_editor_ui_imports.diff || true
echo "Patch saved: ops/patches/phase6_2_1_fix_editor_ui_imports.diff"

# 5) build + smoke
if docker compose version >/dev/null 2>&1; then DC="docker compose"; else DC="docker-compose"; fi
$DC up -d --build
./scripts/smoke.sh
