-- ============================================================
-- Migrasi: integrasi FreeRADIUS (idempoten, aman dijalankan berulang).
-- Menambah kolom pada packages & routers, lalu membuat tabel rad*.
-- ============================================================

-- 1. packages.profile_name — nama grup RADIUS untuk paket
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'packages' AND COLUMN_NAME = 'profile_name'
);
SET @sql = IF(@col_exists = 0,
  "ALTER TABLE packages ADD COLUMN profile_name VARCHAR(64) NULL AFTER type",
  "SELECT 1");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE packages SET profile_name = CONCAT('PKG-', code)
WHERE profile_name IS NULL OR profile_name = '';

-- 2. routers — konfigurasi NAS RADIUS
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'routers' AND COLUMN_NAME = 'radius_enabled'
);
SET @sql = IF(@col_exists = 0,
  "ALTER TABLE routers ADD COLUMN radius_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER ip_pool_isolir",
  "SELECT 1");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'routers' AND COLUMN_NAME = 'nas_secret'
);
SET @sql = IF(@col_exists = 0,
  "ALTER TABLE routers ADD COLUMN nas_secret VARCHAR(400) NULL AFTER radius_enabled",
  "SELECT 1");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'routers' AND COLUMN_NAME = 'nas_identifier'
);
SET @sql = IF(@col_exists = 0,
  "ALTER TABLE routers ADD COLUMN nas_identifier VARCHAR(64) NULL AFTER nas_secret",
  "SELECT 1");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'routers' AND COLUMN_NAME = 'coa_port'
);
SET @sql = IF(@col_exists = 0,
  "ALTER TABLE routers ADD COLUMN coa_port INT NOT NULL DEFAULT 3799 AFTER nas_identifier",
  "SELECT 1");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. Tabel rad* — DDL sama dengan sql/radius/schema.sql (CREATE IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS radcheck (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64) NOT NULL DEFAULT '',
  attribute VARCHAR(64) NOT NULL DEFAULT '',
  op CHAR(2) NOT NULL DEFAULT '==',
  value VARCHAR(253) NOT NULL DEFAULT '',
  INDEX idx_radcheck_username (username(32))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS radreply (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64) NOT NULL DEFAULT '',
  attribute VARCHAR(64) NOT NULL DEFAULT '',
  op CHAR(2) NOT NULL DEFAULT '=',
  value VARCHAR(253) NOT NULL DEFAULT '',
  INDEX idx_radreply_username (username(32))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS radgroupcheck (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  groupname VARCHAR(64) NOT NULL DEFAULT '',
  attribute VARCHAR(64) NOT NULL DEFAULT '',
  op CHAR(2) NOT NULL DEFAULT '==',
  value VARCHAR(253) NOT NULL DEFAULT '',
  INDEX idx_radgroupcheck_groupname (groupname(32))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS radgroupreply (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  groupname VARCHAR(64) NOT NULL DEFAULT '',
  attribute VARCHAR(64) NOT NULL DEFAULT '',
  op CHAR(2) NOT NULL DEFAULT '=',
  value VARCHAR(253) NOT NULL DEFAULT '',
  INDEX idx_radgroupreply_groupname (groupname(32))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS radusergroup (
  username VARCHAR(64) NOT NULL DEFAULT '',
  groupname VARCHAR(64) NOT NULL DEFAULT '',
  priority INT NOT NULL DEFAULT 1,
  INDEX idx_radusergroup_username (username(32))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS radacct (
  radacctid BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  acctsessionid VARCHAR(64) NOT NULL DEFAULT '',
  acctuniqueid VARCHAR(32) NOT NULL DEFAULT '',
  username VARCHAR(64) NOT NULL DEFAULT '',
  groupname VARCHAR(64) NOT NULL DEFAULT '',
  realm VARCHAR(64) DEFAULT '',
  nasipaddress VARCHAR(15) NOT NULL DEFAULT '',
  nasportid VARCHAR(32) DEFAULT NULL,
  nasporttype VARCHAR(32) DEFAULT NULL,
  acctstarttime DATETIME NULL DEFAULT NULL,
  acctupdatetime DATETIME NULL DEFAULT NULL,
  acctstoptime DATETIME NULL DEFAULT NULL,
  acctinterval INT DEFAULT NULL,
  acctsessiontime INT UNSIGNED DEFAULT NULL,
  acctauthentic VARCHAR(32) DEFAULT NULL,
  connectinfo_start VARCHAR(128) DEFAULT NULL,
  connectinfo_stop VARCHAR(128) DEFAULT NULL,
  acctinputoctets BIGINT UNSIGNED DEFAULT NULL,
  acctoutputoctets BIGINT UNSIGNED DEFAULT NULL,
  calledstationid VARCHAR(50) NOT NULL DEFAULT '',
  callingstationid VARCHAR(50) NOT NULL DEFAULT '',
  acctterminatecause VARCHAR(32) NOT NULL DEFAULT '',
  servicetype VARCHAR(32) DEFAULT NULL,
  framedprotocol VARCHAR(32) DEFAULT NULL,
  framedipaddress VARCHAR(15) NOT NULL DEFAULT '',
  framedipv6address VARCHAR(45) NOT NULL DEFAULT '',
  framedipv6prefix VARCHAR(45) NOT NULL DEFAULT '',
  framedinterfaceid VARCHAR(44) NOT NULL DEFAULT '',
  delegatedipv6prefix VARCHAR(45) NOT NULL DEFAULT '',
  UNIQUE KEY acctuniqueid (acctuniqueid),
  INDEX idx_radacct_username (username),
  INDEX idx_radacct_acctsessionid (acctsessionid),
  INDEX idx_radacct_acctstarttime (acctstarttime),
  INDEX idx_radacct_acctstoptime (acctstoptime),
  INDEX idx_radacct_nasipaddress (nasipaddress)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS radpostauth (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64) NOT NULL DEFAULT '',
  pass VARCHAR(64) NOT NULL DEFAULT '',
  reply VARCHAR(32) NOT NULL DEFAULT '',
  authdate TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  nasipaddress VARCHAR(15) NOT NULL DEFAULT '',
  INDEX idx_radpostauth_username (username),
  INDEX idx_radpostauth_authdate (authdate)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS nas (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nasname VARCHAR(128) NOT NULL,
  shortname VARCHAR(32) DEFAULT NULL,
  type VARCHAR(30) DEFAULT 'other',
  ports INT DEFAULT NULL,
  secret VARCHAR(60) NOT NULL DEFAULT 'secret',
  server VARCHAR(64) DEFAULT NULL,
  community VARCHAR(50) DEFAULT NULL,
  description VARCHAR(200) DEFAULT 'RADIUS Client',
  UNIQUE KEY nasname (nasname)
) ENGINE=InnoDB;
