#!/bin/sh
# ============================================================
# Entrypoint script untuk fasty-api
# 1. Tunggu MySQL ready
# 2. Import migration database memakai user aplikasi
# 3. Switch ke app user & start aplikasi
# ============================================================

set -e

# Konfigurasi dari environment
DB_HOST="${DB_HOST:-mysql}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:?DB_USER required}"
DB_PASSWORD="${DB_PASSWORD:?DB_PASSWORD required}"
DB_NAME="${DB_NAME:-fasty_bill}"

echo "[INFO] Menunggu MySQL siap di $DB_HOST:$DB_PORT..."

# Tunggu tanpa batas; MySQL dapat mengambil waktu lama saat inisialisasi volume.
RETRIES=0
until nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; do
  RETRIES=$((RETRIES + 1))
  echo "[WAIT] MySQL belum siap; retry dalam 1 detik... (percobaan $RETRIES)"
  sleep 1
done

echo "[OK] MySQL ready!"

# Jalankan migrasi memakai user aplikasi; migration hanya butuh database fasty_bill.
echo "[INFO] Menjalankan migrasi database..."
if [ -f "/app/sql/migration_production.sql" ]; then
  DB_HOST="$DB_HOST" DB_PORT="$DB_PORT" DB_USER="$DB_USER" \
    DB_PASSWORD="$DB_PASSWORD" DB_NAME="$DB_NAME" node /app/dist/scripts/migrate_production.js
  echo "[OK] Migrasi database selesai!"
else
  echo "[WARN] File migration_production.sql tidak ditemukan di /app/sql/"
fi

# Drop privileges ke app user & start aplikasi
echo "[INFO] Memulai aplikasi..."
exec su -s /bin/sh app -c "node /app/dist/server.js"
