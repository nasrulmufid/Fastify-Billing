-- Migration: Tambah kolom ip_pool_pppoe & ip_pool_isolir ke tabel routers
-- ip_pool_pppoe  = CIDR pool untuk alokasi IP pelanggan baru (PPPoE)
-- ip_pool_isolir = CIDR pool untuk profile ISOLIR di Mikrotik

ALTER TABLE routers
  ADD COLUMN ip_pool_pppoe VARCHAR(45) NULL COMMENT 'CIDR pool PPPoE untuk alokasi IP otomatis, contoh 192.168.200.0/24' AFTER ip_pool,
  ADD COLUMN ip_pool_isolir VARCHAR(45) NULL COMMENT 'CIDR pool untuk profile ISOLIR Mikrotik, contoh 10.99.0.0/24';

-- Migrasi data: bila ip_pool sudah ada, salin ke ip_pool_pppoe
UPDATE routers SET ip_pool_pppoe = ip_pool WHERE ip_pool IS NOT NULL AND ip_pool <> '';
