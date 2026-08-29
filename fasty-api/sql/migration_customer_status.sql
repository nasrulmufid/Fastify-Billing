-- ============================================================
-- Migration: Hapus status "Pending" pada pelanggan
-- Status pelanggan hanya Active (layanan aktif) & Isolated (layanan off).
-- Status "Pending" hanya berlaku untuk invoice, bukan pelanggan.
-- Tanggal: 2026-08-28
-- ============================================================

USE fasty_bill;

-- 1. Ubah pelanggan yang masih Pending -> Isolated (layanan off, bisa login & bayar)
UPDATE customers SET status = 'Isolated' WHERE status = 'Pending';

-- 2. Ubah enum kolom status pelanggan: hapus 'Pending'
ALTER TABLE customers MODIFY COLUMN status ENUM('Active','Isolated') NOT NULL DEFAULT 'Isolated';
