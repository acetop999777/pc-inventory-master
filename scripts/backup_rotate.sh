#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

set -a
[ -f ./.env ] && . ./.env
set +a

KEEP_DUMPS="${BACKUP_KEEP_DUMPS:-30}"
KEEP_SQLS="${BACKUP_KEEP_SQLS:-30}"
MAX_DAYS="${BACKUP_MAX_DAYS:-14}"

mkdir -p backups

# keep newest N
ls -1t backups/*.dump 2>/dev/null | tail -n +$((KEEP_DUMPS+1)) | xargs -r rm -f
ls -1t backups/*.sql  2>/dev/null | tail -n +$((KEEP_SQLS+1))  | xargs -r rm -f

# also delete older than MAX_DAYS for these patterns
find backups -maxdepth 1 -type f -name "inventory_db_*.dump" -mtime +"$MAX_DAYS" -delete 2>/dev/null || true
find backups -maxdepth 1 -type f -name "inventory_db_*.sql"  -mtime +"$MAX_DAYS" -delete 2>/dev/null || true

echo "[rotate] ✅ kept latest dumps=${KEEP_DUMPS}, sqls=${KEEP_SQLS}, max_days=${MAX_DAYS}"
