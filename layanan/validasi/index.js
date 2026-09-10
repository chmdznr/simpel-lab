// SIMPEL - versi BERBROKER - validasi
//
// Consumer dari queue "pengajuan.diterima". Kerangka Lab 3 (MP-6): kode
// koneksi, prefetch, dan logika bisnis sudah jalan -- yang perlu peserta isi
// hanya blok acknowledgment di bawah (ditandai TODO), sesuai materi 6.1-6.2.

const amqp = require("amqplib");
const { Pool } = require("pg");

const AMQP_URL = process.env.AMQP_URL || "amqp://simpel:simpel123@localhost:5672";
const QUEUE_PENGAJUAN = "pengajuan.diterima";
const KERJA_MS = Number(process.env.VALIDASI_KERJA_MS || 120);
// Prefetch/QoS -- batas pesan "in-flight" per konsumen. Ini kunci LI-2:
// bandingkan prefetch=1 (aman, DB tidak dihantam bersamaan) vs prefetch=100
// (rakus, semua pesan diproses nyaris serentak) di Lab 3d.
const PREFETCH = Number(process.env.VALIDASI_PREFETCH || 1);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function kerjaCpuBound(ms) {
  const batas = Date.now() + ms;
  while (Date.now() < batas) {
    // sengaja kosong: membakar siklus CPU, sama seperti sinkron/validasi
  }
}

async function main() {
  const conn = await amqp.connect(AMQP_URL);
  const channel = await conn.createChannel();
  await channel.assertQueue(QUEUE_PENGAJUAN, { durable: true });
  await channel.prefetch(PREFETCH);

  console.log(`[validasi] menunggu pesan di "${QUEUE_PENGAJUAN}" (prefetch=${PREFETCH}) ...`);

  channel.consume(
    QUEUE_PENGAJUAN,
    async (msg) => {
      if (msg === null) return;
      const pengajuan = JSON.parse(msg.content.toString());

      try {
        kerjaCpuBound(KERJA_MS);
        await pool.query(
          "INSERT INTO pengajuan (id, pemohon, jenis, kantor) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING",
          [pengajuan.id, pengajuan.pemohon, pengajuan.jenis, pengajuan.kantor]
        );
        console.log(`[validasi] OK  ${pengajuan.id} (${pengajuan.pemohon})`);

        // TODO(Lab 3b): pesan ini SUDAH BERHASIL diproses dan tersimpan di
        // DB. Beri tahu RabbitMQ supaya pesan ini tidak dikirim ulang ke
        // konsumen manapun.
        // Petunjuk: ada satu method di `channel` untuk acknowledge SATU
        // pesan. Panggil dengan argumen `msg`.
        //
        // channel.____(msg);
      } catch (err) {
        console.error(`[validasi] GAGAL ${pengajuan.id}:`, err.message);

        // TODO(Lab 3b): pesan ini GAGAL diproses (mis. DB sedang down).
        // Beri tahu RabbitMQ supaya pesan DIKEMBALIKAN ke antrean (requeue)
        // agar tidak hilang -- inilah yang membuktikan LI-1 di Lab 3c.
        // Petunjuk: method penolakan pesan di amqplib menerima tiga
        // argumen: (msg, allUpTo, requeue).
        //
        // channel.____(msg, false, true);
      }
    },
    { noAck: false }
  );
}

main().catch((err) => {
  console.error("[validasi] gagal terhubung ke RabbitMQ:", err.message);
  process.exit(1);
});
