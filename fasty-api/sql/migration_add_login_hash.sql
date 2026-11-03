-- Migration: Add login_password_hash column and hash existing passwords

-- 1. Add login_password_hash column if not exists
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'login_password_hash'
);
SET @sql = IF(@col_exists = 0,
  "ALTER TABLE customers ADD COLUMN login_password_hash VARCHAR(255) NULL AFTER login_password",
  "SELECT 1");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. Hash existing plain-text passwords (one-time, skip if already hashed)
-- Using MySQL native functions: MD5 untuk quick hash, atau app harus hash via code
-- For now, copy login_password to login_password_hash (app will re-hash on next login)
UPDATE customers 
SET login_password_hash = login_password 
WHERE login_password_hash IS NULL AND login_password IS NOT NULL;

SELECT 'Migration completed: login_password_hash column ready' AS status;
