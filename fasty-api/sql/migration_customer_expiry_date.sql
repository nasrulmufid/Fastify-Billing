-- ============================================================
-- Migration: ubah kolom expiry_at pelanggan menjadi DATE
-- Sebelumnya DATETIME -> nilai digeser zona waktu (+07:00) saat
-- write, sehingga raw DB berbeda 7 jam dari tampilan UI (WIB).
-- Expiry adalah tanggal kalender, bukan timestamp, jadi DATE
-- menghilangkan ambiguitas zona waktu.
-- Tanggal: 2026-08-28
-- ============================================================

USE fasty_bill;

-- Konversi: potong bagian waktu, simpan hanya tanggal (DATE).
-- DATE(...) mengambil 'YYYY-MM-DD' dari nilai DATETIME yang ada.
ALTER TABLE customers MODIFY COLUMN expiry_at DATE NULL;
