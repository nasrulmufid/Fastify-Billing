-- Migrasi: perbaiki default port REST API Mikrotik (8728 -> 80) & tambah kolom api_use_https
-- 8728 adalah port API legacy (binary), BUKAN REST API.
-- REST API Mikrotik berjalan di port 80 (HTTP) atau 443 (HTTPS).

ALTER TABLE routers
  MODIFY COLUMN api_port INT NULL DEFAULT 80,
  ADD COLUMN api_use_https TINYINT(1) NOT NULL DEFAULT 0 AFTER api_port;

-- Untuk router yang sudah terlanjur disimpan dengan port 8728 (legacy),
-- ubah ke 80 (HTTP REST) agar test/sync bisa terhubung.
UPDATE routers SET api_port = 80 WHERE api_port = 8728;
