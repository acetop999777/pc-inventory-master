#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

KEEP_DUMPS="${BACKUP_KEEP_DUMPS:-30}"
KEEP_SQLS="${BACKUP_KEEP_SQLS:-30}"
MAX_DAYS="${BACKUP_MAX_DAYS:-14}"

mkdir -p backups

# keep latest N
ls -1t backups/*.dump 2>/dev/null | tail -n +$((KEEP_DUMPS+1)) | xargs -r rm -f
ls -1t backups/*.sql  2>/dev/null | tail -n +$((KEEP_SQLS+1))  | xargs -r rm -f

# delete older than MAX_DAYS
find backups -maxdepth 1 -type f \( -name "*.dump" -o -name "*.sql" \) -mtime +"$MAX_DAYS" -print -delete >/dev/null 2>&1
echo "[rotate] ✅ kept latest dumps=${KEEP_DUMPS}, sqls=${KEEP_SQLS}, max_days=${MAX_DAYS}"
