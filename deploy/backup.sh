#!/bin/bash
# Respaldo diario de la base de datos todo_db
# Instalar en cron con:
#   sudo crontab -e
#   0 3 * * * /var/www/todo-app/deploy/backup.sh >> /var/log/todo-api/backup.log 2>&1

set -euo pipefail

BACKUP_DIR="/var/backups/todo-db"
DATE=$(date +%F_%H-%M)
RETENTION_DAYS=7

DB_NAME="todo_db"
DB_USER="todo_user"

mkdir -p "$BACKUP_DIR"

export PGPASSWORD="$(grep DB_PASSWORD /var/www/todo-app/backend/.env | cut -d '=' -f2)"

pg_dump -U "$DB_USER" -h localhost "$DB_NAME" | gzip > "$BACKUP_DIR/todo_db_$DATE.sql.gz"

# Elimina respaldos con más de $RETENTION_DAYS días (respaldo 3-2-1 simplificado)
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "[$(date)] Respaldo completado: todo_db_$DATE.sql.gz"

# Recomendado (paso manual o con rclone): copiar $BACKUP_DIR a un destino externo
# (Google Drive, S3, Azure Blob) para cumplir la regla 3-2-1 de respaldos.
