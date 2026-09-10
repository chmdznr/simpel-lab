-- Additive day-four schema. Earlier tables and participant data are preserved.
CREATE TABLE IF NOT EXISTS alur_pengajuan (
 id text PRIMARY KEY, request_key text UNIQUE NOT NULL, payload jsonb NOT NULL,
 correlation_id text NOT NULL, dibuat_pada timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS alur_validasi (
 pengajuan_id text PRIMARY KEY REFERENCES alur_pengajuan(id), status text NOT NULL
 CHECK (status IN ('reserved','cancelled'))
);
CREATE TABLE IF NOT EXISTS alur_billing (
 pengajuan_id text PRIMARY KEY REFERENCES alur_pengajuan(id), kode text UNIQUE NOT NULL
);
CREATE TABLE IF NOT EXISTS alur_notifikasi (
 pengajuan_id text PRIMARY KEY REFERENCES alur_pengajuan(id), dicatat_pada timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS alur_tracking (
 message_id text PRIMARY KEY, pengajuan_id text NOT NULL REFERENCES alur_pengajuan(id), event text NOT NULL
);
CREATE TABLE IF NOT EXISTS alur_inbox (
 layanan text NOT NULL, message_id text NOT NULL, PRIMARY KEY (layanan,message_id)
);
CREATE TABLE IF NOT EXISTS alur_retry (
 layanan text NOT NULL, message_id text NOT NULL, failures integer NOT NULL,
 PRIMARY KEY (layanan,message_id)
);
CREATE TABLE IF NOT EXISTS alur_outbox (
 id text PRIMARY KEY, owner text NOT NULL, routing_key text NOT NULL, event jsonb NOT NULL,
 headers jsonb NOT NULL DEFAULT '{}',
 available_at timestamptz NOT NULL DEFAULT now(), published_at timestamptz
);
CREATE INDEX IF NOT EXISTS alur_outbox_pending ON alur_outbox(owner,available_at) WHERE published_at IS NULL;
