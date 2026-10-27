-- Migration: Add ACS (GenieACS) configuration storage
-- Adds setting_key + setting_value columns to app_settings for key-value config storage

-- Add new columns for key-value settings storage
ALTER TABLE app_settings
  ADD COLUMN setting_key VARCHAR(64) NULL DEFAULT NULL AFTER billing_cycle,
  ADD COLUMN setting_value TEXT NULL DEFAULT NULL AFTER setting_key;

-- Add index for fast lookups by setting_key
ALTER TABLE app_settings
  ADD INDEX idx_setting_key (setting_key);

-- Insert a placeholder row if table is empty (should not happen but safety net)
INSERT IGNORE INTO app_settings (id, grace_period_days, billing_cycle) VALUES (1, 7, 'Setiap 1 bulan');
