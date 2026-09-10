-- Skema minimal SIMPEL. Dijalankan otomatis saat container postgres pertama dibuat.

CREATE TABLE IF NOT EXISTS pengajuan (
    id          TEXT PRIMARY KEY,
    pemohon     TEXT        NOT NULL,
    jenis       TEXT        NOT NULL,
    kantor      TEXT        NOT NULL,
    status      TEXT        NOT NULL DEFAULT 'diterima',
    dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Legacy draft table retained for existing volumes. MP-08 uses alur_inbox
-- with the composite key (layanan,message_id) in 02-alur.sql instead.
CREATE TABLE IF NOT EXISTS pesan_diproses (
    message_id   TEXT PRIMARY KEY,
    layanan      TEXT        NOT NULL,
    diproses_pada TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Independent tracking effect for Lab 4A; it does not overwrite validation state.
CREATE TABLE IF NOT EXISTS jejak_pengajuan (
    message_id TEXT PRIMARY KEY,
    pengajuan_id TEXT NOT NULL,
    event TEXT NOT NULL,
    dicatat_pada TIMESTAMPTZ NOT NULL DEFAULT now()
);
