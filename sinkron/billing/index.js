// SIMPEL - versi SINKRON - billing
//
// Berpura-pura jadi "sistem eksternal" yang menerbitkan kode billing.
// Tidak ada kerapuhan yang disengaja DI DALAM kode ini -- kerapuhannya adalah
// posisinya di rantai sinkron. Untuk Demo A (MP-2 2.1), layanan ini dimatikan
// sepenuhnya (Ctrl+C prosesnya), bukan diubah kodenya.

const express = require("express");

const PORT = process.env.PORT_BILLING || 3003;

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true, layanan: "billing-sinkron" }));

app.post("/billing", (req, res) => {
  const p = req.body;
  res.json({ ok: true, kodeBilling: `BIL-${p.id.slice(0, 8).toUpperCase()}` });
});

app.listen(PORT, () => {
  console.log(`[billing-sinkron] jalan di http://localhost:${PORT}`);
});
