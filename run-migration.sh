#!/bin/bash
# Execute migration to add type column to wa_templates

DB_HOST="${DB_HOST:-mysql}"
DB_PORT="${DB_PORT:-3306}"
DB_NAME="${DB_NAME:-fasty_bill}"
DB_USER="${DB_USER:-fasty}"
DB_PASSWORD="${DB_PASSWORD:-root}"

# Source .env if exists
if [ -f /home/sysadmin/fasty/.env ]; then
  export $(grep -v '^#' /home/sysadmin/fasty/.env | xargs)
fi

echo "Executing migration on $DB_HOST:$DB_PORT/$DB_NAME"
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" << 'EOF'
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wa_templates' AND COLUMN_NAME = 'type'
);
SET @sql = IF(@col_exists = 0,
  "ALTER TABLE wa_templates ADD COLUMN type ENUM('general', 'reminder_h7', 'reminder_h3', 'reminder_h1', 'isolir') NULL AFTER body COMMENT 'Tipe template: general atau reminder_*'",
  "SELECT 1 AS 'Column type already exists'");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Verify column exists
SELECT COLUMN_NAME, COLUMN_TYPE FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wa_templates' AND COLUMN_NAME = 'type';
EOF

echo "Migration completed"
