-- Migration: Add duration_days to packages table
-- Desc: Track package duration in days for auto-invoice and expiry calculation

ALTER TABLE packages ADD COLUMN duration_days INT NOT NULL DEFAULT 30 AFTER status;
