#!/bin/bash

# --- 1. 配置区域 ---
# 本地备份存放路径
BACKUP_DIR="/home/admin/pc-inventory-master/backups"
# Google Drive 上的目标文件夹 (会自动创建)
REMOTE_DIR="gdrive:/PC_Inventory_Backups"
# 文件名格式 (例如: db_backup_20250105_120000.sql)
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="db_backup_$DATE.sql"

# --- 2. 执行本地导出 ---
# 创建目录
mkdir -p $BACKUP_DIR

echo "[$(date)] Starting Backup..."

# 从 Docker 容器中导出数据库 SQL
# 注意：这里我们导出的是纯 SQL 文本，以后无论结构怎么变，数据内容都在
sudo docker exec pc_inv_db pg_dump -U admin inventory_db > $BACKUP_DIR/$FILENAME

if [ $? -eq 0 ]; then
  echo "Local backup created: $FILENAME"
else
  echo "Error: Database dump failed!"
  exit 1
fi

# --- 3. 上传到 Google Drive ---
echo "Uploading to Google Drive..."
/usr/bin/rclone copy $BACKUP_DIR/$FILENAME $REMOTE_DIR

if [ $? -eq 0 ]; then
  echo "Upload success!"
else
  echo "Error: Rclone upload failed!"
  # 如果上传失败，暂不删除本地文件，保留证据
  exit 1
fi

# --- 4. 清理旧文件 (保留最近 30 天) ---
# 删除本地超过 30 天的
find $BACKUP_DIR -type f -mtime +30 -name "*.sql" -delete

# 删除云端超过 30 天的 (防止 Google Drive 爆满)
/usr/bin/rclone delete $REMOTE_DIR --min-age 30d

echo "[$(date)] All tasks completed."
