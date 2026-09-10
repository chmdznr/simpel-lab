// SIMPEL - versi SINKRON - validasi
//
// CPU-bound: membakar VALIDASI_KERJA_MS milidetik CPU murni per pengajuan lalu
// menulis ke Postgres. Ini sumber LI-2 -- makin banyak pengajuan bersamaan,
// makin banyak koneksi DB dan CPU yang terpakai serentak (dibuktikan lewat
// tools/beban.js di Lab 3d / Lab 5c, bukan di sini).

const express = require("express");
const { Pool } = require("pg");

const PORT = process.env.PORT_VALIDASI || 3002;
const KERJA_MS = Number(process.env.VALIDASI_KERJA_MS || 120);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true, layanan: "validasi-sinkron" }));

// Busy-wait murni CPU, BUKAN setTimeout -- setTimeout hanya menahan I/O,
// sedangkan validasi dokumen sungguhan (parsing, cek format, dsb.) memakai CPU.
function kerjaCpuBound(ms) {
  const batas = Date.now() + ms;
  while (Date.now() < batas) {
    // sengaja kosong: membakar siklus CPU
  }
}

app.post("/validasi", async (req, res) => {
  const p = req.body;
  kerjaCpuBound(KERJA_MS);
  try {
    await pool.query(
      "INSERT INTO pengajuan (id, pemohon, jenis, kantor) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING",
      [p.id, p.pemohon, p.jenis, p.kantor]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`[validasi-sinkron] jalan di http://localhost:${PORT}, kerja CPU ${KERJA_MS}ms/pengajuan`);
});
