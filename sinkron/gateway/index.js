// SIMPEL - versi SINKRON - gateway
//
// Sengaja rapuh: setiap pengajuan menunggu validasi -> billing -> notifikasi
// selesai secara berurutan sebelum menjawab pengguna. Tidak ada broker,
// tidak ada antrean. Ini bahan demo kegagalan di MP-2 (2.1).
//
//   Demo A (LI-1): matikan layanan billing -> semua pengajuan GAGAL total.
//   Demo B (LI-3): notifikasi menunggu NOTIF_DELAY_MS -> response time pengguna
//                   ikut molor sebesar itu, walau billing sudah beres.

const express = require("express");

const PORT = process.env.PORT_GATEWAY || 3001;
const VALIDASI_URL = process.env.VALIDASI_URL || "http://localhost:3002";
const BILLING_URL = process.env.BILLING_URL || "http://localhost:3003";
const NOTIFIKASI_URL = process.env.NOTIFIKASI_URL || "http://localhost:3004";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true, layanan: "gateway-sinkron" }));

// Panggilan HTTP biasa ke layanan lain, dengan timeout supaya "layanan mati"
// tidak menggantung selamanya melainkan gagal dalam waktu wajar.
async function panggil(url, path, body, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${url}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`${path} balas status ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

app.post("/pengajuan", async (req, res) => {
  const mulai = Date.now();
  const pengajuan = {
    id: crypto.randomUUID(),
    pemohon: req.body.pemohon || "Anonim",
    jenis: req.body.jenis || "umum",
    kantor: req.body.kantor || "pusat",
  };

  try {
    // 1) Validasi dokumen - CPU-bound, hantam DB (sumber LI-2, lihat sinkron/validasi).
    await panggil(VALIDASI_URL, "/validasi", pengajuan);

    // 2) Terbitkan kode billing - bergantung "sistem eksternal" (sumber LI-1).
    //    Kalau layanan ini mati, fetch() di atas melempar error dan seluruh
    //    pengajuan gagal -- padahal dokumen sudah tervalidasi.
    const billing = await panggil(BILLING_URL, "/billing", pengajuan);

    // 3) Kirim notifikasi - pihak ketiga lambat (sumber LI-3).
    //    Pengguna HARUS menunggu langkah ini selesai sebelum melihat respons.
    await panggil(NOTIFIKASI_URL, "/notifikasi", pengajuan);

    const durasiMs = Date.now() - mulai;
    res.json({ ok: true, pengajuan, kodeBilling: billing.kodeBilling, durasiMs });
  } catch (err) {
    const durasiMs = Date.now() - mulai;
    res.status(502).json({ ok: false, pengajuan, error: err.message, durasiMs });
  }
});

app.listen(PORT, () => {
  console.log(`[gateway-sinkron] jalan di http://localhost:${PORT}`);
});
