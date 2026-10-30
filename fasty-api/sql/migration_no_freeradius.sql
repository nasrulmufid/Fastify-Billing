-- ============================================================
-- Migrasi branch no-freeradius (idempoten, aman dijalankan berulang):
--   1. Tambah kolom offline_message di wa_api_config (custom pesan
--      "server offline" dari halaman WA Gateway).
--   2. Buat tabel router_sync_queue — antrian sinkronisasi ulang
--      profile PPPoE saat Mikrotik offline; diproses job berkala
--      begitu router online kembali.
--   3. (Opsional/aman) Hapus objek FreeRADIUS yang tidak dipakai lagi:
--      tabel rad* + nas, kolom radius_* di routers/packages.
-- ============================================================
USE fasty_bill;

-- 1. kolom offline_message
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wa_api_config' AND COLUMN_NAME = 'offline_message'
);
SET @sql = IF(@col_exists = 0,
  "ALTER TABLE wa_api_config ADD COLUMN offline_message TEXT NULL AFTER auto_reconnect",
  "SELECT 1");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. tabel antrian sync
CREATE TABLE IF NOT EXISTS router_sync_queue (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  customer_id BIGINT UNSIGNED NOT NULL,
  router_id BIGINT UNSIGNED NOT NULL,
  reason VARCHAR(200) NULL,
  status ENUM('pending','done','failed') NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME NULL,
  INDEX idx_sync_queue_status (status),
  INDEX idx_sync_queue_router (router_id)
) ENGINE=InnoDB;

-- 3. Bersihkan objek FreeRADIUS (aman: hanya drop bila ada)
SET @tbl_exists = (
  SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'radacct'
);
SET @sql = IF(@tbl_exists > 0, "DROP TABLE IF EXISTS radpostauth, radacct, radusergroup, radgroupreply, radgroupcheck, radreply, radcheck, nas", "SELECT 1");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Kolom radius di routers (bila pernah ditambah migrasi_radius.sql)
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'routers' AND COLUMN_NAME = 'radius_enabled'
);
SET @sql = IF(@col_exists > 0,
  "ALTER TABLE routers DROP COLUMN radius_enabled, DROP COLUMN nas_secret, DROP COLUMN nas_identifier, DROP COLUMN coa_port",
  "SELECT 1");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Kolom profile_name di packages (nama grup RADIUS — tidak dipakai lagi)
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'packages' AND COLUMN_NAME = 'profile_name'
);
SET @sql = IF(@col_exists > 0, "ALTER TABLE packages DROP COLUMN profile_name", "SELECT 1");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
