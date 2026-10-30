-- ============================================================
-- Migrasi: tambah kolom seen_at ke tabel notification_logs
-- Tujuannya: melacak notifikasi yang sudah dibaca (untuk badge
-- "belum dibaca" di navbar). File ini AMAN dijalankan berulang
-- kali (idempoten).
-- ============================================================

-- 1. Tambah kolom seen_at bila belum ada
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notification_logs' AND COLUMN_NAME = 'seen_at'
);
SET @add_sql = IF(@col_exists = 0,
  "ALTER TABLE notification_logs ADD COLUMN seen_at DATETIME NULL AFTER status",
  "SELECT 1");
PREPARE stmt FROM @add_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Index untuk query unread (seen_at IS NULL) bila belum ada
SET @idx_exists = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notification_logs' AND INDEX_NAME = 'idx_notif_seen'
);
SET @add_idx_sql = IF(@idx_exists = 0,
  "ALTER TABLE notification_logs ADD INDEX idx_notif_seen (seen_at)",
  "SELECT 1");
PREPARE stmt FROM @add_idx_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
