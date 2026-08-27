-- ============================================================
-- Migration: Hapus fitur Hotspot — sisakan PPPoE saja
-- Tanggal: 2026-08-27
-- ============================================================

USE fasty_bill;

-- 1. Hapus tabel hotspot_profiles
DROP TABLE IF EXISTS hotspot_profiles;

-- 2. Hapus tabel hotspot_users
DROP TABLE IF EXISTS hotspot_users;

-- 3. Hapus tabel voucher_templates (hanya dipakai hotspot)
DROP TABLE IF EXISTS voucher_templates;

-- 4. Ubah kolom type di tabel packages — hapus enum Hotspot & Static IP
ALTER TABLE packages MODIFY COLUMN type ENUM('PPPoE') NOT NULL DEFAULT 'PPPoE';

-- 5. Hapus semua data yang bertipe Hotspot atau Static IP dari packages
DELETE FROM packages WHERE type IN ('Hotspot', 'Static IP');

-- 6. Ubah default type menjadi PPPoE untuk semua package yang belum punya tipe
UPDATE packages SET type = 'PPPoE' WHERE type IS NULL OR type = '';
