-- Migration: Add reminder template type column
-- Idempoten: tambah kolom type bila belum ada

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wa_templates' AND COLUMN_NAME = 'type'
);
SET @sql = IF(@col_exists = 0,
  "ALTER TABLE wa_templates ADD COLUMN type ENUM('general', 'reminder_h7', 'reminder_h3', 'reminder_h1', 'isolir') NULL AFTER body COMMENT 'Tipe template: general atau reminder_*'",
  "SELECT 1");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
