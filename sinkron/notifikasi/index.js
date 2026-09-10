// SIMPEL - versi SINKRON - notifikasi
//
// Berpura-pura mengirim SMS/email lewat pihak ketiga yang lambat. Delay
// NOTIF_DELAY_MS ini sumber LI-3: karena gateway memanggilnya secara sinkron,
// pengguna ikut menunggu penuh delay ini sebelum menerima respons (Demo B, MP-2 2.1).

const express = require("express");

const PORT = process.env.PORT_NOTIFIKASI || 3004;
const DELAY_MS = Number(process.env.NOTIF_DELAY_MS || 3000);

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true, layanan: "notifikasi-sinkron" }));

const tunggu = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

app.post("/notifikasi", async (req, res) => {
  await tunggu(DELAY_MS);
  res.json({ ok: true, terkirimKe: req.body.pemohon });
});

app.listen(PORT, () => {
  console.log(`[notifikasi-sinkron] jalan di http://localhost:${PORT}, delay ${DELAY_MS}ms`);
});
