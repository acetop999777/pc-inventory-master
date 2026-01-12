 set -euo pipefail
cd ~/pc-inventory-master

SRC="client/src/presentation/modules/ClientEditor"
DST="client/src/features/clients/editor"

# 0) 安全检查
test -d "$SRC" || (echo "ERROR: not found $SRC" && exit 1)
mkdir -p "$DST"

# 1) 备份（保留你 Phase6.1 的 facade index 以便对照）
if [ -f "$DST/index.ts" ]; then
  mv "$DST/index.ts" "$DST/index.facade.ts"
fi

# 2) 复制整个 ClientEditor 模块到 feature/editor（排除 index.ts/tsx 避免覆盖）
if command -v rsync >/dev/null 2>&1; then
  rsync -a \
    --exclude 'index.ts' --exclude 'index.tsx' \
    "$SRC"/ "$DST"/
else
  # rsync 不存在时用 tar 复制（同样排除 index）
  tar -C "$SRC" --exclude 'index.ts' --exclude 'index.tsx' -cf - . | tar -C "$DST" -xf -
fi

# 3) 生成新的 feature/editor 入口：导出本地 components（不再指向 presentation）
cat > "$DST/index.ts" <<'EOF'
export { IdentityCard } from './components/IdentityCard';
export { LogisticsCard } from './components/LogisticsCard';
export { FinancialsCard } from './components/FinancialsCard';
export { NotesCard } from './components/NotesCard';
export { SpecsTable } from './components/SpecsTable';
EOF

# 4) 确认 ClientDetailPage 仍然从 './editor' 引用（不需要改）
grep -n "from './editor'" client/src/features/clients/ClientDetailPage.tsx

# 5) build + smoke（先别 commit，确认全绿）
if docker compose version >/dev/null 2>&1; then DC="docker compose"; else DC="docker-compose"; fi
$DC up -d --build
./scripts/smoke.sh

