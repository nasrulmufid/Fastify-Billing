#!/bin/sh
# ============================================================
# Entrypoint FreeRADIUS — pasang konfigurasi custom lalu jalankan radiusd.
# File di /etc/raddb/custom (volume read-only) disalin ke lokasi baku
# karena radiusd menolak mengikuti symlink lintas direktori tertentu.
# ============================================================
set -e

RADIUS_SECRET="${RADIUS_SECRET:-testing123}"
export DB_HOST DB_PORT DB_NAME DB_USER DB_PASS RADIUS_SECRET

CUSTOM=/etc/raddb/custom

# 1. clients.conf — gabungkan client docker + NAS dari DB
cp "$CUSTOM/clients.conf" /etc/raddb/clients.d/custom.conf 2>/dev/null || \
  cp "$CUSTOM/clients.conf" /etc/raddb/clients.conf

# 2. Modul SQL
mkdir -p /etc/raddb/mods-enabled
sed -e "s/\${DB_HOST}/$DB_HOST/g" \
    -e "s/\${DB_PORT}/$DB_PORT/g" \
    -e "s/\${DB_NAME}/$DB_NAME/g" \
    -e "s/\${DB_USER}/$DB_USER/g" \
    -e "s/\${DB_PASS}/$DB_PASS/g" \
    "$CUSTOM/mods-sql" > /etc/raddb/mods-enabled/sql

# 3. Site default
cp "$CUSTOM/site-default" /etc/raddb/sites-enabled/default

echo "[radius-entrypoint] Konfigurasi terpasang. Menjalankan radiusd -X..."
exec radiusd -X
