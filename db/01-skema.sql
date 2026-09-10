-- Skema minimal SIMPEL. Dijalankan otomatis saat container postgres pertama dibuat.

CREATE TABLE IF NOT EXISTS pengajuan (
    id          TEXT PRIMARY KEY,
    pemohon     TEXT        NOT NULL,
    jenis       TEXT        NOT NULL,
    kantor      TEXT        NOT NULL,
    status      TEXT        NOT NULL DEFAULT 'diterima',
    dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabel dedup untuk MP-8 (idempotensi). Konsumen mencatat message_id yang
-- sudah pernah diproses; PRIMARY KEY yang menolak duplikat adalah mekanismenya.
CREATE TABLE IF NOT EXISTS pesan_diproses (
    message_id   TEXT PRIMARY KEY,
    layanan      TEXT        NOT NULL,
    diproses_pada TIMESTAMPTZ NOT NULL DEFAULT now()
);
