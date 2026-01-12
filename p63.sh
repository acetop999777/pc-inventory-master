set -euo pipefail
cd ~/pc-inventory-master

mkdir -p ops/patches

OLD="presentation/modules/ClientEditor/components"
NEW="features/clients/editor/components"

echo "== Before (should show matches) =="
grep -RIn "$OLD" client/src || true

# 只替换 import 路径文本（简单、可审阅）
find client/src -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' \) -print0 \
  | xargs -0 perl -pi -e "s|\\Q$OLD\\E|$NEW|g"

echo "== After (should be empty) =="
grep -RIn "$OLD" client/src || true

# 保存补丁
git diff > ops/patches/phase6_3_0_repoint_clienteditor_imports.diff || true
echo "Patch saved: ops/patches/phase6_3_0_repoint_clienteditor_imports.diff"

# 先 build+smoke（不急着删目录）
if docker compose version >/dev/null 2>&1; then DC="docker compose"; else DC="docker-compose"; fi
$DC up -d --build
./scripts/smoke.sh
