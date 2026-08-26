-- ============================================================
-- Migration: Ubah customer code dari "CUST-XXXX" ke 6-digit number
-- Contoh: CUST-1001 -> 001001, CUST-1030 -> 001030
-- Next code akan dimulai dari 001031 dst.
-- ============================================================
USE fasty_bill;

-- Update semua code existing: ambil angka setelah "CUST-" dan zero-pad jadi 6 digit
UPDATE customers 
SET code = LPAD(CAST(SUBSTRING(code, 6) AS UNSIGNED), 6, '0')
WHERE code LIKE 'CUST-%';

-- Verify hasil
SELECT id, code, name FROM customers ORDER BY CAST(code AS UNSIGNED);
