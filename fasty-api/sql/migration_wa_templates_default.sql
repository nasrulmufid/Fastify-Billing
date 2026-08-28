-- ============================================================
-- Migration: Seed default WA templates (H-7, H-3, H-1, Isolir, Sukses)
-- Template ini dipakai oleh job reminder otomatis & pengiriman manual.
-- Fallback di wa.service.ts hanya dipakai bila tabel wa_templates kosong.
-- Idempoten: gunakan INSERT IGNORE agar aman dijalankan berulang kali.
-- Tanggal: 2026-08-29
-- ============================================================

USE fasty_bill;

INSERT IGNORE INTO wa_templates (code, name, body) VALUES
('TPL-001', 'Pengingat Tagihan H-7', 'Yth {nama}, kami mengingatkan bahwa tagihan internet Anda sebesar {jumlah} akan jatuh tempo pada {tanggal}. Mohon menyiapkan pembayaran. Terima kasih.'),
('TPL-002', 'Pembayaran Sukses', 'Halo {nama}, pembayaran tagihan {no_invoice} sebesar {jumlah} telah kami terima. Masa aktif paket {paket} Anda diperpanjang.'),
('TPL-003', 'Pemberitahuan Isolir', 'Yth {nama}, koneksi internet Anda telah diisolir karena belum melakukan pembayaran tagihan sebesar {jumlah} (jatuh tempo {tanggal}). Hubungi admin untuk informasi dan cara pembayaran. Terima kasih.'),
('TPL-004', 'Pengingat Tagihan H-3', 'Yth {nama}, tagihan internet Anda sebesar {jumlah} akan jatuh tempo dalam 3 hari ({tanggal}). Mohon segera melakukan pembayaran agar layanan tetap aktif. Terima kasih.'),
('TPL-005', 'Pengingat Tagihan H-1', 'Yth {nama}, ini pengingat terakhir: tagihan internet Anda sebesar {jumlah} jatuh tempo besok ({tanggal}). Segera lakukan pembayaran untuk menghindari isolir. Terima kasih.');
