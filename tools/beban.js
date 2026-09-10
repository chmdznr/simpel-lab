// Pembangkit beban SIMPEL.
//
// Menembak N pengajuan ke gateway (berapa pun jumlahnya sekaligus, dibatasi
// KONKURENSI) lalu melaporkan p50/p95 response time dan tingkat kegagalan.
// Dipakai membuktikan LI-2 (beban DB) dan LI-3 (response time) dengan angka
// nyata -- bandingkan hasilnya antara versi sinkron/ dan layanan/.
//
// Pemakaian:
//   node tools/beban.js [jumlah] [konkurensi] [url]
//   node tools/beban.js 100 10 http://localhost:3001/pengajuan

const JUMLAH = Number(process.argv[2] || 50);
const KONKURENSI = Number(process.argv[3] || 10);
const URL = process.argv[4] || `http://localhost:${process.env.PORT_GATEWAY || 3001}/pengajuan`;

function persentil(nilaiUrut, p) {
  if (nilaiUrut.length === 0) return 0;
  const idx = Math.min(nilaiUrut.length - 1, Math.ceil((p / 100) * nilaiUrut.length) - 1);
  return nilaiUrut[idx];
}

async function satuPengajuan(i) {
  const mulai = Date.now();
  try {
    const res = await fetch(URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pemohon: `Beban-${i}`, jenis: "uji-beban", kantor: "pusat" }),
    });
    const durasiMs = Date.now() - mulai;
    return { ok: res.ok, durasiMs };
  } catch (err) {
    return { ok: false, durasiMs: Date.now() - mulai, error: err.message };
  }
}

// Jalankan dalam gelombang seukuran KONKURENSI, bukan sekaligus JUMLAH --
// supaya angka mencerminkan "beban puncak realistis", bukan sekadar
// membanjiri event loop klien.
async function jalankanBeban() {
  const hasil = [];
  for (let mulai = 0; mulai < JUMLAH; mulai += KONKURENSI) {
    const gelombang = [];
    for (let i = mulai; i < Math.min(mulai + KONKURENSI, JUMLAH); i++) {
      gelombang.push(satuPengajuan(i));
    }
    hasil.push(...(await Promise.all(gelombang)));
  }
  return hasil;
}

async function main() {
  console.log(`Menembak ${JUMLAH} pengajuan (konkurensi ${KONKURENSI}) ke ${URL} ...`);
  const t0 = Date.now();
  const hasil = await jalankanBeban();
  const totalMs = Date.now() - t0;

  const durasi = hasil.map((h) => h.durasiMs).sort((a, b) => a - b);
  const gagal = hasil.filter((h) => !h.ok);

  console.log("");
  console.log("=== Hasil beban ===");
  console.log(`Total waktu wall-clock : ${totalMs} ms`);
  console.log(`Jumlah pengajuan       : ${JUMLAH}`);
  console.log(`Gagal                  : ${gagal.length} (${((gagal.length / JUMLAH) * 100).toFixed(1)}%)`);
  console.log(`p50 response time      : ${persentil(durasi, 50)} ms`);
  console.log(`p95 response time      : ${persentil(durasi, 95)} ms`);
  console.log(`min / max               : ${durasi[0] ?? 0} / ${durasi[durasi.length - 1] ?? 0} ms`);
  if (gagal.length > 0) {
    console.log(`Contoh error pertama    : ${gagal[0].error || "HTTP non-2xx"}`);
  }
}

main();
