// SIMPEL - versi BERBROKER - gateway
//
// Bedanya dari sinkron/gateway: di sini gateway TIDAK menunggu validasi,
// billing, atau notifikasi selesai. Ia hanya menitipkan pesan ke RabbitMQ lalu
// langsung menjawab pengguna. Inilah yang membuat LI-1 dan LI-3 membaik --
// dipakai mulai Lab 3 (MP-6).

const express = require("express");
const amqp = require("amqplib");

const PORT = process.env.PORT_GATEWAY || 3001;
const AMQP_URL = process.env.AMQP_URL || "amqp://simpel:simpel123@localhost:5672";
const QUEUE_PENGAJUAN = "pengajuan.diterima";

let channel;

async function mulaiKoneksiBroker() {
  const conn = await amqp.connect(AMQP_URL);
  channel = await conn.createChannel();
  // durable: true -- queue-nya sendiri bertahan walau RabbitMQ restart.
  // Pesan di dalamnya baru bertahan kalau tiap publish juga persistent:true.
  await channel.assertQueue(QUEUE_PENGAJUAN, { durable: true });
  console.log(`[gateway] terhubung ke broker, queue "${QUEUE_PENGAJUAN}" siap`);
}

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true, layanan: "gateway-berbroker" }));

app.post("/pengajuan", (req, res) => {
  const mulai = Date.now();
  const pengajuan = {
    id: crypto.randomUUID(),
    pemohon: req.body.pemohon || "Anonim",
    jenis: req.body.jenis || "umum",
    kantor: req.body.kantor || "pusat",
  };

  const terkirim = channel.sendToQueue(
    QUEUE_PENGAJUAN,
    Buffer.from(JSON.stringify(pengajuan)),
    { persistent: true, messageId: pengajuan.id, contentType: "application/json" }
  );

  // Gateway berhenti di sini -- TIDAK menunggu validasi/billing/notifikasi.
  // Bandingkan durasiMs ini dengan sinkron/gateway saat billing mati atau
  // notifikasi lambat: di sini angkanya nyaris konstan.
  res.status(202).json({ ok: terkirim, pengajuan, durasiMs: Date.now() - mulai });
});

mulaiKoneksiBroker()
  .then(() => app.listen(PORT, () => console.log(`[gateway-berbroker] jalan di http://localhost:${PORT}`)))
  .catch((err) => {
    console.error("[gateway] gagal terhubung ke RabbitMQ:", err.message);
    process.exit(1);
  });
