-- ============================================================
-- Seed data fasty_bill
-- Catatan: user admin dibuat di scripts/migrate.ts (bcrypt.hashSync)
-- ============================================================
USE fasty_bill;

-- ------------------------------------------------------------
-- packages (PKG-01..04)
-- ------------------------------------------------------------
INSERT INTO packages (code, name, download_speed, upload_speed, price, type, status, description) VALUES
('PKG-01', 'Paket 10 Mbps', 10, 10, 150000, 'PPPoE', 'Aktif', 'Paket hemat untuk browsing, media sosial, dan streaming ringan.'),
('PKG-02', 'Paket 20 Mbps', 20, 20, 250000, 'PPPoE', 'Aktif', 'Cocok untuk keluarga dengan streaming HD dan video call.'),
('PKG-03', 'Paket 30 Mbps', 30, 30, 350000, 'PPPoE', 'Aktif', 'Untuk rumah dengan banyak perangkat dan gaming online.'),
('PKG-04', 'Paket 50 Mbps', 50, 50, 500000, 'PPPoE', 'Aktif', 'Kecepatan tinggi untuk kebutuhan bisnis dan power user.');

-- ------------------------------------------------------------
-- routers
-- ------------------------------------------------------------
INSERT INTO routers (name, host, provider, status, client_count, uptime) VALUES
('Mikrotik-Core-01', '192.168.1.1:8728', 'Mikrotik', 'Connected', 18, '24 hari 7 jam'),
('Mikrotik-Core-02', '192.168.1.2:8728', 'Mikrotik', 'Connected', 9, '24 hari 7 jam'),
('Radius-ISP-01', '192.168.1.3:1812', 'FreeRADIUS', 'Standby', 3, '—');

-- ------------------------------------------------------------
-- customers (CUST-1001..1030) — selaras seed frontend
-- ------------------------------------------------------------
INSERT INTO customers
(code, name, email, phone, address, package_id, router_id, status, ip_address,
 pppoe_username, pppoe_password, login_username, login_password, odp_id, gps, last_payment_at, expiry_at, join_at) VALUES
('001001', 'Budi Santoso', 'budi@email.com', '0812-3456-7890', 'RT 02 / RW 04, Kel. Merdeka', 2, 1, 'Active', '192.168.1.2', 'ppp-budi', 'budi#2026', 'budi.santoso', 'budi2026', 'ODP-01 / Port 4', '-6.9175, 107.6191', '2026-08-02', '2026-09-10', '2025-01-12'),
('001002', 'Siti Aminah', 'siti@email.com', '0813-9876-5432', 'RT 01 / RW 05, Kel. Harapan', 1, 1, 'Pending', '192.168.1.3', 'ppp-siti', 'siti#2026', 'siti.aminah', 'siti2026', 'ODP-02 / Port 1', '-6.9180, 107.6195', '2026-07-15', '2026-08-05', '2025-03-20'),
('001003', 'Rizki Putra', 'rizki@email.com', '0815-1111-2222', 'RT 03 / RW 02, Kel. Sejahtera', 3, 2, 'Isolated', '192.168.1.4', 'ppp-rizki', 'rizki#2026', 'rizki.putra', 'rizki2026', 'ODP-03 / Port 2', '-6.9170, 107.6188', '2026-07-20', '2026-08-01', '2025-04-05'),
('001004', 'Dewi Lestari', 'dewi@email.com', '0821-3344-5566', 'Jl. Melati No. 12, Kel. Cempaka', 4, 3, 'Active', '192.168.1.5', 'ppp-dewi', 'dewi#2026', 'dewi.lestari', 'dewi2026', 'ODP-01 / Port 6', '-6.9160, 107.6200', '2026-08-01', '2026-09-15', '2025-06-18'),
('001005', 'Agus Wijaya', 'agus@email.com', '0856-7777-8899', 'Jl. Kenanga No. 5, Kel. Mawar', 2, 1, 'Active', '192.168.1.6', 'ppp-agus', 'agus#2026', 'agus.wijaya', 'agus2026', 'ODP-02 / Port 3', '-6.9185, 107.6210', '2026-07-28', '2026-08-28', '2025-02-02'),
('001006', 'Nur Aini', 'nur@email.com', '0812-9090-8080', 'RT 04 / RW 03, Kel. Damai', 1, 2, 'Pending', '192.168.1.7', 'ppp-nur', 'nur#2026', 'nur.aini', 'nur2026', 'ODP-03 / Port 5', '-6.9155, 107.6199', NULL, '2026-08-20', '2026-07-25'),
('001007', 'Hendra Gunawan', 'hendra@email.com', '0857-2222-1111', 'Jl. Flamboyan No. 8, Kel. Asri', 3, 1, 'Active', '192.168.1.8', 'ppp-hendra', 'hendra#2026', 'hendra.gunawan', 'hendra2026', 'ODP-01 / Port 8', '-6.9190, 107.6180', '2026-07-30', '2026-08-30', '2025-05-11'),
('001008', 'Ratna Sari', 'ratna@email.com', '0813-5555-4444', 'RT 02 / RW 06, Kel. Karya', 1, 3, 'Isolated', '192.168.1.9', 'ppp-ratna', 'ratna#2026', 'ratna.sari', 'ratna2026', 'ODP-02 / Port 7', '-6.9148, 107.6205', '2026-07-10', '2026-08-10', '2025-09-15'),
('001009', 'Fajar Ramadhan', 'fajar@email.com', '0822-6666-7777', 'Jl. Anggrek No. 21, Kel. Indah', 4, 2, 'Active', '192.168.1.10', 'ppp-fajar', 'fajar#2026', 'fajar.ramadhan', 'fajar2026', 'ODP-03 / Port 1', '-6.9172, 107.6178', '2026-08-05', '2026-10-05', '2025-01-23'),
('001010', 'Maya Anggraini', 'maya@email.com', '0856-8888-9999', 'RT 01 / RW 02, Kel. Sentosa', 2, 1, 'Active', '192.168.1.11', 'ppp-maya', 'maya#2026', 'maya.anggraini', 'maya2026', 'ODP-01 / Port 2', '-6.9165, 107.6193', '2026-07-25', '2026-08-25', '2025-04-30'),
('001011', 'Yudi Pratama', 'yudi@email.com', '0812-1212-3434', 'Jl. Dahlia No. 3, Kel. Bahagia', 3, 2, 'Pending', '192.168.1.12', 'ppp-yudi', 'yudi#2026', 'yudi.pratama', 'yudi2026', 'ODP-02 / Port 9', '-6.9182, 107.6215', NULL, '2026-08-18', '2026-08-01'),
('001012', 'Sari Wulandari', 'sari@email.com', '0857-7777-0000', 'RT 05 / RW 04, Kel. Rukun', 1, 3, 'Active', '192.168.1.13', 'ppp-sari', 'sari#2026', 'sari.wulandari', 'sari2026', 'ODP-03 / Port 6', '-6.9150, 107.6185', '2026-08-03', '2026-09-03', '2025-07-14'),
('001013', 'Bambang Susilo', 'bambang@email.com', '0813-4444-3333', 'Jl. Cendana No. 15, Kel. Makmur', 2, 1, 'Isolated', '192.168.1.14', 'ppp-bambang', 'bambang#2026', 'bambang.susilo', 'bambang2026', 'ODP-01 / Port 10', '-6.9178, 107.6208', '2026-06-30', '2026-07-30', '2025-03-09'),
('001014', 'Intan Permata', 'intan@email.com', '0821-9999-8888', 'RT 03 / RW 05, Kel. Lestari', 4, 2, 'Active', '192.168.1.15', 'ppp-intan', 'intan#2026', 'intan.permata', 'intan2026', 'ODP-02 / Port 4', '-6.9168, 107.6190', '2026-08-04', '2026-10-04', '2025-05-27'),
('001015', 'Eko Prasetyo', 'eko@email.com', '0856-3333-2222', 'Jl. Teratai No. 9, Kel. Aman', 1, 1, 'Active', '192.168.1.16', 'ppp-eko', 'eko#2026', 'eko.prasetyo', 'eko2026', 'ODP-03 / Port 8', '-6.9195, 107.6175', '2026-07-22', '2026-08-22', '2025-10-19'),
('001016', 'Lina Marlina', 'lina@email.com', '0812-4545-6767', 'RT 06 / RW 03, Kel. Sukma', 2, 3, 'Pending', '192.168.1.17', 'ppp-lina', 'lina#2026', 'lina.marlina', 'lina2026', 'ODP-01 / Port 12', '-6.9140, 107.6212', NULL, '2026-08-12', '2026-07-28'),
('001017', 'Adi Saputra', 'adi@email.com', '0813-1111-2222', 'Jl. Mawar No. 7, Kel. Cempaka', 3, 1, 'Active', '192.168.1.18', 'ppp-adi', 'adi#2026', 'adi.saputra', 'adi2026', 'ODP-02 / Port 5', '-6.9162, 107.6189', '2026-08-01', '2026-09-01', '2025-08-15'),
('001018', 'Rina Kartika', 'rina@email.com', '0857-2222-3333', 'RT 03 / RW 01, Kel. Mawar', 2, 2, 'Active', '192.168.1.19', 'ppp-rina', 'rina#2026', 'rina.kartika', 'rina2026', 'ODP-03 / Port 3', '-6.9177, 107.6202', '2026-07-29', '2026-08-29', '2025-09-03'),
('001019', 'Toni Hidayat', 'toni@email.com', '0821-3333-4444', 'Jl. Kamboja No. 4, Kel. Indah', 1, 3, 'Isolated', '192.168.1.20', 'ppp-toni', 'toni#2026', 'toni.hidayat', 'toni2026', 'ODP-01 / Port 15', '-6.9158, 107.6179', '2026-06-25', '2026-07-25', '2024-11-11'),
('001020', 'Putri Melati', 'putri@email.com', '0856-4444-5555', 'RT 02 / RW 05, Kel. Lestari', 4, 1, 'Active', '192.168.1.21', 'ppp-putri', 'putri#2026', 'putri.melati', 'putri2026', 'ODP-02 / Port 8', '-6.9188, 107.6218', '2026-08-05', '2026-09-05', '2025-02-22'),
('001021', 'Andi Firmansyah', 'andi@email.com', '0812-5555-6666', 'Jl. Anggrek No. 18, Kel. Damai', 2, 2, 'Pending', '192.168.1.22', 'ppp-andi', 'andi#2026', 'andi.firmansyah', 'andi2026', 'ODP-03 / Port 7', '-6.9145, 107.6197', NULL, '2026-08-22', '2026-08-02'),
('001022', 'Sri Wahyuni', 'sri@email.com', '0857-6666-7777', 'RT 04 / RW 02, Kel. Karya', 1, 3, 'Active', '192.168.1.23', 'ppp-sri', 'sri#2026', 'sri.wahyuni', 'sri2026', 'ODP-01 / Port 9', '-6.9173, 107.6183', '2026-07-31', '2026-08-31', '2025-10-17'),
('001023', 'Deni Kurniawan', 'deni@email.com', '0813-7777-8888', 'Jl. Flamboyan No. 11, Kel. Asri', 3, 1, 'Isolated', '192.168.1.24', 'ppp-deni', 'deni#2026', 'deni.kurniawan', 'deni2026', 'ODP-02 / Port 12', '-6.9191, 107.6207', '2026-07-05', '2026-08-05', '2024-12-08'),
('001024', 'Wulan Sari', 'wulan@email.com', '0822-8888-9999', 'RT 01 / RW 06, Kel. Rukun', 2, 2, 'Active', '192.168.1.25', 'ppp-wulan', 'wulan#2026', 'wulan.sari', 'wulan2026', 'ODP-03 / Port 10', '-6.9152, 107.6215', '2026-08-04', '2026-09-04', '2025-03-29'),
('001025', 'Bagus Prasetyo', 'bagus@email.com', '0856-9999-0000', 'Jl. Cendana No. 22, Kel. Makmur', 4, 3, 'Active', '192.168.1.26', 'ppp-bagus', 'bagus#2026', 'bagus.prasetyo', 'bagus2026', 'ODP-01 / Port 18', '-6.9180, 107.6196', '2026-08-06', '2026-09-06', '2025-06-14'),
('001026', 'Fitri Handayani', 'fitri@email.com', '0812-0000-1111', 'RT 05 / RW 03, Kel. Sentosa', 1, 1, 'Pending', '192.168.1.27', 'ppp-fitri', 'fitri#2026', 'fitri.handayani', 'fitri2026', 'ODP-02 / Port 14', '-6.9169, 107.6187', NULL, '2026-08-19', '2026-07-30'),
('001027', 'Gilang Ramadhan', 'gilang@email.com', '0857-1111-2222', 'Jl. Melati No. 30, Kel. Cempaka', 3, 2, 'Active', '192.168.1.28', 'ppp-gilang', 'gilang#2026', 'gilang.ramadhan', 'gilang2026', 'ODP-03 / Port 4', '-6.9147, 107.6201', '2026-07-27', '2026-08-27', '2025-11-05'),
('001028', 'Ayu Lestari', 'ayu@email.com', '0821-2222-3333', 'RT 03 / RW 04, Kel. Bahagia', 2, 3, 'Active', '192.168.1.29', 'ppp-ayu', 'ayu#2026', 'ayu.lestari', 'ayu2026', 'ODP-01 / Port 6', '-6.9183, 107.6192', '2026-08-03', '2026-09-03', '2025-04-21'),
('001029', 'Reza Maulana', 'reza@email.com', '0856-3333-4444', 'Jl. Kenanga No. 14, Kel. Mawar', 1, 1, 'Isolated', '192.168.1.30', 'ppp-reza', 'reza#2026', 'reza.maulana', 'reza2026', 'ODP-02 / Port 16', '-6.9175, 107.6210', '2026-06-18', '2026-07-18', '2024-08-12'),
('001030', 'Citra Ayu', 'citra@email.com', '0813-4444-5555', 'RT 06 / RW 05, Kel. Harapan', 2, 2, 'Active', '192.168.1.31', 'ppp-citra', 'citra#2026', 'citra.ayu', 'citra2026', 'ODP-03 / Port 11', '-6.9156, 107.6198', '2026-07-26', '2026-08-26', '2025-07-09');

-- ------------------------------------------------------------
-- invoices (INV-1038..1047)
-- ------------------------------------------------------------
INSERT INTO invoices (code, customer_id, amount, status, period, payment_method, payment_code, due_at) VALUES
('INV-1038', 1, 250000, 'Paid', 'Agustus 2026', 'QRIS', 'PY-1011', '2026-09-01'),
('INV-1039', 2, 150000, 'Paid', 'Agustus 2026', 'Tunai', 'PY-1012', '2026-09-01'),
('INV-1040', 3, 350000, 'Unpaid', 'Agustus 2026', NULL, NULL, '2026-09-01'),
('INV-1041', 4, 500000, 'Paid', 'Agustus 2026', 'QRIS', 'PY-1014', '2026-09-01'),
('INV-1042', 5, 250000, 'Paid', 'Agustus 2026', 'Tunai', 'PY-1015', '2026-09-01'),
('INV-1043', 1, 250000, 'Unpaid', 'Agustus 2026', NULL, NULL, '2026-09-01'),
('INV-1044', 2, 150000, 'Paid', 'Agustus 2026', 'QRIS', 'PY-1017', '2026-09-01'),
('INV-1045', 3, 350000, 'Paid', 'Agustus 2026', 'Tunai', 'PY-1018', '2026-09-01'),
('INV-1046', 4, 500000, 'Overdue', 'Juli 2026', NULL, NULL, '2026-08-01'),
('INV-1047', 5, 250000, 'Paid', 'Agustus 2026', 'Tunai', 'PY-1020', '2026-09-01');

-- ------------------------------------------------------------
-- payments (PY-1011..1020)
-- ------------------------------------------------------------
INSERT INTO payments (code, customer_id, invoice_id, method, amount, paid_at, status, gateway_ref) VALUES
('PY-1011', 1, 1, 'QRIS', 250000, '2026-08-02 10:30:00', 'Sukses', 'pay_1001'),
('PY-1012', 2, 2, 'Tunai', 150000, '2026-08-03 09:00:00', 'Sukses', NULL),
('PY-1013', 3, 3, 'QRIS', 350000, '2026-08-04 14:20:00', 'Pending', 'pay_1003'),
('PY-1014', 4, 4, 'QRIS', 500000, '2026-08-05 11:00:00', 'Sukses', 'pay_1004'),
('PY-1015', 5, 5, 'Tunai', 250000, '2026-08-05 15:30:00', 'Sukses', NULL),
('PY-1016', 1, 6, 'QRIS', 250000, '2026-08-06 08:45:00', 'Pending', 'pay_1006'),
('PY-1017', 2, 7, 'QRIS', 150000, '2026-08-06 16:10:00', 'Sukses', 'pay_1007'),
('PY-1018', 3, 8, 'Tunai', 350000, '2026-08-07 10:00:00', 'Sukses', NULL),
('PY-1019', 4, 9, 'QRIS', 500000, '2026-08-07 13:40:00', 'Ditolak', 'pay_1009'),
('PY-1020', 5, 10, 'Tunai', 250000, '2026-08-08 09:20:00', 'Sukses', NULL);

-- ------------------------------------------------------------
-- tickets (TCK-1042..1040) + timeline
-- ------------------------------------------------------------
INSERT INTO tickets (code, customer_id, title, category, description, status) VALUES
('TCK-1042', 1, 'Internet tidak tersambung', 'Gangguan jaringan', 'Internet di rumah tidak dapat tersambung sejak pagi.', 'Selesai'),
('TCK-1041', 7, 'Kecepatan menurun drastis', 'Kecepatan lambat', 'Kecepatan download turun drastis di malam hari.', 'Diproses'),
('TCK-1040', 9, 'Ganti paket layanan', 'Permintaan perubahan', 'Ingin upgrade dari 30 Mbps ke 50 Mbps.', 'Dibuka');

INSERT INTO ticket_timeline (ticket_id, status, actor, note) VALUES
(1, 'Dibuka', 'Sistem', 'Tiket dibuat otomatis oleh sistem berdasarkan laporan pelanggan.'),
(1, 'Diproses', 'Teknisi', 'Teknisi diterjunkan ke lokasi untuk pengecekan jaringan.'),
(1, 'Selesai', 'Admin', 'Koneksi dipulihkan. Masalah pada kabel ODP.'),
(2, 'Dibuka', 'Sistem', 'Tiket dibuat otomatis oleh sistem.'),
(2, 'Diproses', 'Teknisi', 'Sedang dilakukan pengecekan upstream.');

-- ------------------------------------------------------------
-- wa_templates (TPL-001..003)
-- ------------------------------------------------------------
INSERT INTO wa_templates (code, name, body) VALUES
('TPL-001', 'Pengingat Tagihan', 'Yth {nama}, tagihan internet Anda sebesar {jumlah} jatuh tempo {tanggal}. Mohon segera melakukan pembayaran. Terima kasih.'),
('TPL-002', 'Pembayaran Sukses', 'Halo {nama}, pembayaran tagihan {no_invoice} sebesar {jumlah} telah kami terima. Masa aktif paket {paket} Anda diperpanjang.'),
('TPL-003', 'Pemberitahuan Isolir', 'Yth {nama}, koneksi internet Anda akan diisolir karena belum melakukan pembayaran. Hubungi admin untuk informasi lebih lanjut.');

-- ------------------------------------------------------------
-- wa_api_config (single row)
-- ------------------------------------------------------------
INSERT INTO wa_api_config (id, server_url, api_key, device_name, webhook_url, auto_reconnect) VALUES
(1, 'https://api.go-whatsapp.example.com', '', 'RT-RW-Net-Bot', 'https://billing.example.com/webhook/wa', TRUE);

-- ------------------------------------------------------------
-- notification_logs (NT-1003..1005)
-- ------------------------------------------------------------
INSERT INTO notification_logs (code, type, customer_id, channel, status, sent_at, error) VALUES
('NT-1003', 'payment', 1, 'WhatsApp', 'Terkirim', '2026-08-05 10:05:00', NULL),
('NT-1004', 'due', 8, 'WhatsApp', 'Gagal', '2026-08-06 08:00:00', 'Nomor tidak terdaftar'),
('NT-1005', 'isolir', 13, 'Telegram', 'Terkirim', '2026-08-07 23:00:00', NULL);

-- ------------------------------------------------------------
-- app_settings (single row)
-- ------------------------------------------------------------
INSERT INTO app_settings (id, grace_period_days, billing_cycle) VALUES
(1, 7, 'Setiap 1 bulan');

-- ------------------------------------------------------------
-- payment_gateway_config (single row, placeholder — diisi via UI)
-- ------------------------------------------------------------
INSERT INTO payment_gateway_config (id) VALUES (1);
