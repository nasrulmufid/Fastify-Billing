-- Migrasi: tambahkan kolom kredensial REST API Mikrotik ke tabel routers
-- Jalankan manual jika DB sudah ada (schema.sql hanya berlaku untuk DB baru).

ALTER TABLE routers
  ADD COLUMN api_port INT NULL DEFAULT 8728 AFTER provider,
  ADD COLUMN api_user VARCHAR(80) NULL DEFAULT 'admin' AFTER api_port,
  ADD COLUMN api_password VARCHAR(400) NULL AFTER api_user;
