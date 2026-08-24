-- Tambah kolom ip_pool pada tabel routers untuk alokasi IP otomatis PPPoE.
-- Format: CIDR, contoh "192.168.200.0/24".
-- Bila diisi, setiap pelanggan baru di router ini yang tidak mengisi IP manual
-- akan mendapat IP berikutnya dari pool tersebut (oktet terakhir naik urut).

ALTER TABLE routers
  ADD COLUMN ip_pool VARCHAR(45) NULL
    COMMENT 'CIDR pool PPPoE, contoh 192.168.200.0/24' AFTER api_password;
