#!/bin/sh
# ============================================================
# Entrypoint script untuk fasty-api
# 1. Tunggu MySQL ready
# 2. Import migration database (sebagai root)
# 3. Switch ke app user & start aplikasi
# ============================================================

set -e

# Konfigurasi dari environment
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-fasty}"
DB_PASS="${DB_PASS:-changeme_db}"
DB_NAME="${DB_NAME:-fasty_bill}"
MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-changeme_root}"

echo "[INFO] Menunggu MySQL siap di $DB_HOST:$DB_PORT..."

# Loop sampai MySQL ready (max 60 detik)
RETRIES=60
while [ $RETRIES -gt 0 ]; do
  if nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; then
    echo "[OK] MySQL ready!"
    break
  fi
  echo "[WAIT] Retry dalam 1 detik... ($RETRIES tersisa)"
  sleep 1
  RETRIES=$((RETRIES - 1))
done

if [ $RETRIES -eq 0 ]; then
  echo "[ERROR] MySQL tidak merespons dalam 60 detik. Keluar."
  exit 1
fi

# Import migration database (hanya jika belum ada tabel users)
echo "[INFO] Mengecek status database..."
MIGRATION_NEEDED=false

# Try to check with root user (untuk migration)
QUERY_CHECK=$(mysql -h "$DB_HOST" -u root -p"$MYSQL_ROOT_PASSWORD" --skip-ssl -e "SELECT COUNT(*) FROM $DB_NAME.users LIMIT 1;" 2>/dev/null || echo "0")

if echo "$QUERY_CHECK" | grep -q "1"; then
  echo "[SKIP] Database sudah termigrasi (tabel users ada)."
else
  MIGRATION_NEEDED=true
fi

# Jalankan migrasi jika diperlukan
if [ "$MIGRATION_NEEDED" = "true" ]; then
  echo "[INFO] Menjalankan migrasi database..."
  if [ -f "/app/sql/migration_production.sql" ]; then
    mysql -h "$DB_HOST" -u root -p"$MYSQL_ROOT_PASSWORD" --skip-ssl < /app/sql/migration_production.sql
    echo "[OK] Migrasi database selesai!"
  else
    echo "[WARN] File migration_production.sql tidak ditemukan di /app/sql/"
  fi
fi

# Switch ke app user & start aplikasi
echo "[INFO] Memulai aplikasi..."
exec node /app/dist/server.js
