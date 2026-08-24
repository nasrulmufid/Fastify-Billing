-- Migrasi: tambahkan 'router' ke ENUM type di notification_logs
-- Jalankan manual jika DB sudah ada.

ALTER TABLE notification_logs
  MODIFY COLUMN type ENUM('payment','isolir','due','reminder','ticket','router') NOT NULL;
