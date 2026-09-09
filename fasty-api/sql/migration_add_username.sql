-- ============================================================
-- Migrasi: tambah kolom username ke tabel users
-- Tujuannya: login admin menggunakan username, bukan email.
-- File ini AMAN dijalankan berulang kali (idempoten) dan bisa
-- dipakai untuk memperbaiki DB yang sudah ada (schema lama).
-- ============================================================

-- 1. Tambah kolom username bila belum ada
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'username'
);
SET @add_sql = IF(@col_exists = 0,
  "ALTER TABLE users ADD COLUMN username VARCHAR(60) NULL AFTER name",
  "SELECT 1");
PREPARE stmt FROM @add_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Backfill username dari email (bagian sebelum '@') untuk baris yg belum punya.
--    Jika email kosong, gunakan 'user<id>' sebagai fallback unik.
UPDATE users
SET username = COALESCE(NULLIF(SUBSTRING_INDEX(email, '@', 1), ''), CONCAT('user', id))
WHERE username IS NULL OR username = '';

-- 3. Pastikan user super_admin menggunakan username 'admin' dan password 'admin'.
--    Hash di bawah valid untuk password "admin" (bcrypt, salt bcryptjs).
UPDATE users
SET username = 'admin',
    password_hash = '$2a$10$Ku5HmEISVl7rjkSe6kcp2u1wtQ0v2dTJxfvTZ18IGgYhAspkep58K'
WHERE role = 'super_admin';

-- 4. Tangani kemungkinan duplikat username dengan menambahkan suffix angka.
--    (Hanya berjalan jika ada duplikat; aman dijalankan berulang.)
UPDATE users u1
JOIN users u2
  ON u1.id > u2.id AND u1.username = u2.username
SET u1.username = CONCAT(u1.username, u1.id);

-- 5. Tambahkan constraint UNIQUE pada username bila belum ada.
SET @idx_exists = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'username'
);
SET @idx_sql = IF(@idx_exists = 0,
  "ALTER TABLE users ADD UNIQUE KEY username (username)",
  "SELECT 1");
PREPARE stmt2 FROM @idx_sql;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

-- 6. Ubah kolom menjadi NOT NULL (setelah backfill, semua baris punya nilai).
ALTER TABLE users MODIFY username VARCHAR(60) NOT NULL;

-- 7. email menjadi opsional (NULL diperbolehkan).
ALTER TABLE users MODIFY email VARCHAR(160) NULL;
