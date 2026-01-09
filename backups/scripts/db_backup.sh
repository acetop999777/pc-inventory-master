#!/bin/bash
set -o pipefail

# ================= 最终配置 =================
BACKUP_DIR="/home/admin/pc-inventory-master/backups"
CONTAINER_NAME="pc_inv_db"
DB_USER="admin"
DB_NAME="inventory_db"  # 这里修正为 inventory_db
# ===========================================

DATE=$(date +%Y%m%d_%H%M%S)
FILE_NAME="db_backup_${DB_NAME}_$DATE.sql.gz"

mkdir -p $BACKUP_DIR

echo "[$(date)] 开始备份数据库: $DB_NAME ..."

if docker exec -t $CONTAINER_NAME pg_dump -U $DB_USER $DB_NAME | gzip > $BACKUP_DIR/$FILE_NAME; then
    FILE_SIZE=$(du -h $BACKUP_DIR/$FILE_NAME | cut -f1)
    echo "[$(date)] 备份成功: $FILE_SIZE"
else
    echo "[$(date)] 备份失败! (已清理)"
    rm -f $BACKUP_DIR/$FILE_NAME
    exit 1
fi

# 清理旧备份 (保留7天)
find $BACKUP_DIR -name "db_backup_*.sql.gz" -type f -mtime +7 -exec rm {} \;
