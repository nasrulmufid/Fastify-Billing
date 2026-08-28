-- ============================================================
-- Skema Database fasty_bill (MySQL/MariaDB)
-- Sesuai Backend.PRD.md — 18 tabel
-- ============================================================

CREATE DATABASE IF NOT EXISTS fasty_bill
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE fasty_bill;

-- ------------------------------------------------------------
-- users — akun staf (auth & manajemen user)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('super_admin','admin','finance','teknisi') NOT NULL DEFAULT 'admin',
  status ENUM('Aktif','Nonaktif') NOT NULL DEFAULT 'Aktif',
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- packages — paket layanan
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS packages (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  download_speed INT NOT NULL DEFAULT 10,
  upload_speed INT NOT NULL DEFAULT 10,
  price DECIMAL(12,0) NOT NULL,
  type ENUM('PPPoE') NOT NULL DEFAULT 'PPPoE',
  status ENUM('Aktif','Nonaktif') NOT NULL DEFAULT 'Aktif',
  description TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- routers — router/node Mikrotik & provider
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS routers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  host VARCHAR(160) NOT NULL UNIQUE, -- "ip:port" atau "domain:port"
  provider VARCHAR(60) NOT NULL DEFAULT 'Mikrotik',
  api_port INT NULL DEFAULT 80, -- port REST API Mikrotik (HTTP=80, HTTPS=443)
  api_use_https TINYINT(1) NOT NULL DEFAULT 0, -- 1 = gunakan HTTPS (port 443)
  api_user VARCHAR(80) NULL DEFAULT 'admin',
  api_password VARCHAR(400) NULL, -- terenkripsi (AES-256-GCM)
  ip_pool_pppoe VARCHAR(45) NULL COMMENT 'CIDR pool PPPoE untuk alokasi IP otomatis',
  ip_pool_isolir VARCHAR(45) NULL COMMENT 'CIDR pool untuk profile ISOLIR Mikrotik',
  status ENUM('Connected','Standby','Disconnected') NOT NULL DEFAULT 'Standby',
  client_count INT NOT NULL DEFAULT 0,
  uptime VARCHAR(60) NOT NULL DEFAULT '—',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- customers — pelanggan
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NULL,
  phone VARCHAR(30) NOT NULL,
  address TEXT NULL,
  package_id BIGINT UNSIGNED NULL,
  router_id BIGINT UNSIGNED NULL,
  status ENUM('Active','Isolated') NOT NULL DEFAULT 'Isolated',
  ip_address VARCHAR(45) NOT NULL,
  pppoe_username VARCHAR(80) NOT NULL,
  pppoe_password VARCHAR(120) NOT NULL,
  login_username VARCHAR(80) NOT NULL,
  login_password VARCHAR(120) NOT NULL,
  odp_id VARCHAR(60) NULL,
  gps VARCHAR(80) NULL,
  last_payment_at DATETIME NULL,
  expiry_at DATE NULL,
  join_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_customers_package FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE SET NULL,
  CONSTRAINT fk_customers_router FOREIGN KEY (router_id) REFERENCES routers(id) ON DELETE SET NULL,
  INDEX idx_customers_name (name),
  INDEX idx_customers_status (status),
  INDEX idx_customers_package (package_id),
  INDEX idx_customers_router (router_id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- invoices — tagihan
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoices (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  customer_id BIGINT UNSIGNED NOT NULL,
  amount DECIMAL(12,0) NOT NULL,
  status ENUM('Paid','Unpaid','Overdue') NOT NULL DEFAULT 'Unpaid',
  period VARCHAR(30) NOT NULL, -- "Agustus 2026"
  payment_method ENUM('QRIS','Tunai') NULL,
  payment_code VARCHAR(20) NULL,
  due_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_invoices_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  INDEX idx_invoices_status (status),
  INDEX idx_invoices_customer (customer_id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- payments — pembayaran (QRIS gateway / Tunai)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  customer_id BIGINT UNSIGNED NOT NULL,
  invoice_id BIGINT UNSIGNED NULL,
  method ENUM('QRIS','Tunai') NOT NULL,
  amount DECIMAL(12,0) NOT NULL,
  paid_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status ENUM('Sukses','Pending','Ditolak') NOT NULL DEFAULT 'Pending',
  gateway_ref VARCHAR(80) NULL, -- payment_id dari SumoPod
  status_note TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_payments_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_payments_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL,
  INDEX idx_payments_status (status),
  INDEX idx_payments_gateway (gateway_ref)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- tickets — tiket gangguan
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tickets (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  customer_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(200) NOT NULL,
  category VARCHAR(80) NOT NULL,
  description TEXT NULL,
  status ENUM('Dibuka','Diproses','Selesai') NOT NULL DEFAULT 'Dibuka',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_tickets_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  INDEX idx_tickets_status (status)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- ticket_timeline — riwayat status tiket
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ticket_timeline (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ticket_id BIGINT UNSIGNED NOT NULL,
  status ENUM('Dibuka','Diproses','Selesai') NOT NULL,
  actor VARCHAR(80) NOT NULL DEFAULT 'Sistem',
  note TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_timeline_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- wa_templates — template pesan WA Gateway
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wa_templates (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE, -- TPL-001
  name VARCHAR(120) NOT NULL,
  body TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- wa_api_config — konfigurasi GO WhatsApp API (single-row)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wa_api_config (
  id TINYINT UNSIGNED NOT NULL DEFAULT 1 PRIMARY KEY,
  server_url VARCHAR(255) NULL,
  api_key VARCHAR(255) NULL, -- terenkripsi
  device_name VARCHAR(120) NULL,
  webhook_url VARCHAR(255) NULL,
  auto_reconnect BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- notification_logs — log notifikasi otomatis
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notification_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE, -- NT-1012
  type ENUM('payment','isolir','due','reminder','ticket','router') NOT NULL,
  customer_id BIGINT UNSIGNED NULL,
  channel ENUM('WhatsApp','Telegram') NOT NULL DEFAULT 'WhatsApp',
  status ENUM('Terkirim','Gagal') NOT NULL DEFAULT 'Terkirim',
  sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  error TEXT NULL,
  CONSTRAINT fk_notif_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  INDEX idx_notif_status (status)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- activity_logs — log aktivitas sistem
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activity_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NULL,
  actor VARCHAR(120) NOT NULL DEFAULT 'Sistem',
  action VARCHAR(120) NOT NULL,
  target VARCHAR(160) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_activity_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_activity_created (created_at)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- app_settings — pengaturan umum (single-row)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_settings (
  id TINYINT UNSIGNED NOT NULL DEFAULT 1 PRIMARY KEY,
  grace_period_days INT NOT NULL DEFAULT 7,
  billing_cycle VARCHAR(30) NOT NULL DEFAULT 'Setiap 1 bulan',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- payment_gateway_config — kredensial SumoPod (single-row)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_gateway_config (
  id TINYINT UNSIGNED NOT NULL DEFAULT 1 PRIMARY KEY,
  api_key VARCHAR(255) NULL, -- terenkripsi
  webhook_signing_secret VARCHAR(255) NULL, -- terenkripsi
  webhook_token VARCHAR(255) NULL, -- terenkripsi
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;
