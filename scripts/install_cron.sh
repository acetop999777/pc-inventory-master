#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

CRON_MARK="# pc-inventory-master backups"
JOB_DAILY="10 3 * * * cd $ROOT && KEEP_DUMPS=30 KEEP_SQLS=30 MAX_DAYS=14 ./scripts/backup_rotate.sh >> $ROOT/backups/cron.log 2>&1"
JOB_WEEKLY="30 3 * * 0 cd $ROOT && ./scripts/pgdata_backup.sh >> $ROOT/backups/cron.log 2>&1"

( crontab -l 2>/dev/null | grep -v "$CRON_MARK"  echo "$CRON_MARK"
  echo "$JOB_DAILY"
  echo "$JOB_WEEKLY"
) | crontab -

echo "[cron] ✅ installed"
crontab -l | tail -n 10
