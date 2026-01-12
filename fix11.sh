set -euo pipefail

# ---- 0) 自动定位项目目录（优先当前目录，其次 ~/pc-inventory-master）----
if [ -f docker-compose.yml ]; then
  PROJECT_DIR="$PWD"
elif [ -f "$HOME/pc-inventory-master/docker-compose.yml" ]; then
  PROJECT_DIR="$HOME/pc-inventory-master"
else
  echo "ERROR: 找不到 docker-compose.yml。请 cd 到项目目录后重试。" >&2
  exit 1
fi
cd "$PROJECT_DIR"

# ---- 1) 选择 compose 命令（docker compose / docker-compose）----
if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DC="docker-compose"
else
  echo "ERROR: 未找到 docker compose。" >&2
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="$HOME/backups/pc-inventory/$TS"
mkdir -p "$BACKUP_DIR"

BASE="$(basename "$PROJECT_DIR")"
PARENT="$(dirname "$PROJECT_DIR")"

echo "[1/6] 写入元信息..."
{
  echo "date: $(date -Is)"
  echo "host: $(hostname)"
  echo "project_dir: $PROJECT_DIR"
  echo "git_head: $(git rev-parse --short HEAD 2>/dev/null || echo 'no-git')"
  echo "git_branch: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'no-git')"
  echo "docker: $(docker --version 2>/dev/null || true)"
  echo "compose: $($DC version 2>/dev/null || true)"
  echo "compose_ps:"
  $DC ps || true
} > "$BACKUP_DIR/meta.txt"

echo "[2/6] DB 逻辑备份（pg_dump）..."
# 注意：inventory_db 是你 docker-compose.yml 里 POSTGRES_DB
docker exec -i pc_inv_db pg_dump -U admin -d inventory_db -Fc > "$BACKUP_DIR/inventory_db.dump"
docker exec -i pc_inv_db pg_dump -U admin -d inventory_db --no-owner --no-privileges > "$BACKUP_DIR/inventory_db.sql"

echo "[3/6] 停止服务（保证 PG 卷物理快照一致性）..."
$DC stop

echo "[4/6] 备份 PG 数据卷（物理快照）..."
PG_VOL="$(docker inspect pc_inv_db --format '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Name}}{{end}}{{end}}')"
echo "$PG_VOL" > "$BACKUP_DIR/pg_volume_name.txt"

docker run --rm \
  -v "$PG_VOL":/data \
  -v "$BACKUP_DIR":/backup \
  alpine:3.20 sh -c 'cd /data && tar -czf /backup/pgdata.tar.gz .'

echo "[5/6] 备份项目目录（全量 + 瘦身源码）..."
# 全量：包含 node_modules / .git / 你当前目录所有内容（体积可能很大）
tar -czf "$BACKUP_DIR/project_all.tar.gz" -C "$PARENT" "$BASE"

# 源码瘦身：更适合日常备份/迁移（建议保留）
tar -czf "$BACKUP_DIR/project_src.tar.gz" \
  --exclude="$BASE/node_modules" \
  --exclude="$BASE/client/node_modules" \
  --exclude="$BASE/server/node_modules" \
  --exclude="$BASE/client/build" \
  --exclude="$BASE/client/dist" \
  --exclude="$BASE/server/dist" \
  --exclude="$BASE/db-data" \
  --exclude="$BASE/pgdata" \
  -C "$PARENT" "$BASE"

echo "[6/6] 启动服务..."
$DC up -d

echo "✅ 备份完成：$BACKUP_DIR"
ls -lh "$BACKUP_DIR"
