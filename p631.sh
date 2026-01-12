set -euo pipefail
cd ~/pc-inventory-master

# 再做一次最后确认：旧路径不应存在引用
grep -RIn "presentation/modules/ClientEditor" client/src && {
  echo "ERROR: still referenced; not deleting."
  exit 1
} || true

# 删除旧目录（这一步才是真正的清理）
git rm -r client/src/presentation/modules/ClientEditor

# 记录补丁
git diff > ops/patches/phase6_3_1_remove_old_clienteditor_module.diff || true
echo "Patch saved: ops/patches/phase6_3_1_remove_old_clienteditor_module.diff"

# build+smoke
if docker compose version >/dev/null 2>&1; then DC="docker compose"; else DC="docker-compose"; fi
$DC up -d --build
./scripts/smoke.sh
