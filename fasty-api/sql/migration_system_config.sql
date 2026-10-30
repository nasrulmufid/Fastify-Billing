-- ============================================================
-- Migrasi: tabel system_config (key-value store) (idempoten)
--
-- LATAR: tabel app_settings hanya punya SATU baris (id=1) dengan
-- satu pasang kolom setting_key/setting_value. Menyimpan lebih dari
-- satu konfigurasi (telegram_config, genieacs_config, dll) membuat
-- config saling MENIMPA. Tabel system_config berisi satu baris per
-- key sehingga tiap konfigurasi punya tempat sendiri.
--
-- Data yang sudah tersimpan di app_settings dimigrasi otomatis ke
-- system_config bila ada. app_settings tetap dipakai untuk
-- pengaturan umum single-row (grace period, billing cycle).
-- ============================================================
USE fasty_bill;

-- 1. Tabel system_config
CREATE TABLE IF NOT EXISTS system_config (
  config_key VARCHAR(64) NOT NULL PRIMARY KEY,
  config_value TEXT NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. Migrasi data lama dari app_settings (bila ada & belum dimigrasi)
INSERT IGNORE INTO system_config (config_key, config_value)
  SELECT setting_key, setting_value
  FROM app_settings
  WHERE setting_key IS NOT NULL AND setting_value IS NOT NULL;

-- 3. Bersihkan kolom key-value di app_settings (kini murni single-row pengaturan umum)
UPDATE app_settings SET setting_key = NULL, setting_value = NULL WHERE id = 1;
