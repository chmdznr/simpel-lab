# Lab 5 — SIMPEL end-to-end

**Kamis 17 September 2026.** MP-08 terdiri dari teori 09.30–10.15 dan 10.30–11.15, lalu praktik 11.15–12.00 serta 13.00–14.30. Praktik berjumlah 3 × 45 menit. Semua efek dan identitas pada lab ini fiktif.

## Persiapan

Jalankan dari root simpel-lab. Gunakan Node 20.6+, dependensi yang sudah terpasang, serta RabbitMQ/Postgres lokal. Jangan menimpa .env yang sudah dikonfigurasi.

```sh
docker compose up -d rabbitmq postgres
npm install
npm run db:siapkan
```

Perintah db:siapkan menambahkan tabel alur_* tanpa menghapus tabel/data hari sebelumnya. Hentikan gateway dan consumer hari ketiga sebelum membuka gateway pada port 3001. Implementasi hari keempat ada di `layanan/alur.js`; nama antreannya alur.*, terpisah dari simpel.*.

| Proses | Perintah di terminal masing-masing |
|---|---|
| Gateway + relay outbox miliknya | npm run alur:gateway |
| Validasi + relay | npm run alur:validasi |
| Billing + relay | npm run alur:billing |
| Notifikasi + relay | npm run alur:notifikasi |
| Tracking | npm run alur:tracking |

Konfigurasi default ALUR_WORK_MS=120, ALUR_NOTIF_MS=300, ALUR_POOL_MAX=4, ALUR_PREFETCH=1. Variabel yang sudah diekspor shell mengalahkan nilai .env pada Node. Pastikan ALUR_TRANSPORT=async. Peran terpisah berbagi satu database untuk kemudahan kelas; ini bukan contoh isolasi database dan kredensial produksi.

## Lab 5a — Alur, status, dan duplikat (45 menit)

Menit 0–10: hidupkan lima proses. Periksa http://127.0.0.1:3001/health di browser. Ready menunjukkan DB dapat menerima pengajuan. brokerReady menunjukkan koneksi broker secara terpisah.

Menit 10–25: simpan skrip berikut sebagai berkas lokal percobaan, atau gunakan REST client yang tersedia. Contoh Node ini hanya mengakses layanan di laptop sendiri.

```js
const base = 'http://127.0.0.1:3001';
const send = () => fetch(base + '/pengajuan', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'Idempotency-Key': 'kelas-001'
  },
  body: JSON.stringify({
    pemohon: 'Peserta sintetis', jenis: 'siup', kantor: 'jakarta'
  })
});
const response = await send();
const receipt = await response.json();
console.log(response.status, receipt);
console.log(await (await fetch(base + receipt.statusUrl)).json());
```

Respons 202 berarti pengajuan dan event outbox berhasil commit dalam satu transaksi. Poll statusUrl sampai SELESAI. Urutan yang mungkin terlihat adalah DITERIMA, VALID, BILLING_TERBIT, SELESAI; polling boleh melewatkan keadaan antara yang singkat.

Menit 25–35: ulangi key dan payload yang sama, termasuk dua permintaan bersamaan. ID pengajuan harus tetap sama. Ubah jenis dengan key yang sama: respons harus 409. Key merupakan identitas permintaan, messageId identitas event, correlationId penghubung rangkaian, dan pengajuanId identitas bisnis.

Menit 35–45: periksa tabel berikut melalui klien SQL lokal:

```sql
SELECT layanan, count(*) FROM alur_inbox GROUP BY layanan;
SELECT event, count(*) FROM alur_tracking GROUP BY event;
SELECT owner, count(*) FROM alur_outbox
WHERE published_at IS NULL GROUP BY owner;
```

Tracking memperoleh empat event untuk alur normal. Validasi dan tracking boleh mencatat messageId sumber yang sama karena primary key inbox adalah (layanan,message_id). Dedup insert, efek DB, dan event berikutnya berada dalam satu transaksi. Ack dilakukan sesudah commit.

**Bukti 5a:** receipt, status akhir, satu ID untuk key berulang, respons 409, dan empat event tracking. Bedakan satu efek DB dari satu pemanggilan handler. Notifikasi hanya receipt DB sintetis, tidak mengirim email/SMS sungguhan.

## Lab 5b — Billing berhenti dan kompensasi (45 menit)

Menit 0–15: hentikan hanya proses billing dengan Ctrl+C. Kirim beberapa pengajuan dengan key berbeda. HTTP tetap 202, status berhenti pada VALID, dan alur.billing.q bertambah. Validasi tidak menyatakan billing selesai.

Menit 15–25: jalankan kembali billing. Antrean diproses tanpa mengirim ulang HTTP. Pemulihan koneksi broker di dalam proses dilakukan otomatis dengan jeda; proses yang dihentikan tetap harus dihidupkan oleh peserta atau supervisor.

Menit 25–35: kirim jenis `uji-gagal` dengan key baru. Ini fault injection yang sengaja disediakan untuk kelas. Billing gagal tiga attempt terjadwal, dengan retry tertunda dua detik melalui outbox ke alur.retry. Sesudah batas, pesan masuk alur.billing.dlq dan event billing.gagal diterbitkan. Validasi mengubah reservasi reserved menjadi cancelled dan menerbitkan pengajuan.dibatalkan. Status akhirnya DIBATALKAN.

Menit 35–45: diskusikan perbedaan gangguan sementara, kegagalan bisnis permanen, dan pesan dengan kontrak rusak. Jangan replay permohonan yang sudah dibatalkan secara buta. Pemilik bisnis harus menentukan apakah perlu permohonan baru atau operasi pembukaan kembali yang sah. Replay teknis Lab 4B tidak otomatis menjadi kebijakan bisnis Lab 5.

**Bukti 5b:** status VALID ketika billing mati, status SELESAI sesudah restart, DLQ untuk jenis uji-gagal, reservasi cancelled, dan tidak ada kode billing untuk permohonan gagal.

## Lab 5c — Burst 500 dengan dua jam pengukuran (45 menit)

Menit 0–5: tetapkan kondisi yang sama: 500 permintaan unik, concurrency 50, ALUR_WORK_MS=120 (pg_sleep yang memegang koneksi DB), ALUR_NOTIF_MS=300 (delay simulasi notifikasi), pool 4, dan prefetch 4 untuk setiap consumer async. Gunakan database yang sama dan matikan proses beban lain. Catat versi Node/RabbitMQ, perangkat, serta waktu uji.

Menit 5–20: hentikan lima proses. Jalankan pembanding terkontrol:

```sh
ALUR_TRANSPORT=sync ALUR_WORK_MS=120 ALUR_NOTIF_MS=300 ALUR_POOL_MAX=4 npm run alur:gateway
# Terminal lain
node --env-file=.env tools/beban-alur.js
```

Menit 20–35: hentikan gateway tersebut. Hidupkan kembali lima proses async, semuanya memakai nilai workload yang sama dan ALUR_PREFETCH=4. Jalankan tools/beban-alur.js lagi. Setiap eksekusi membuat key baru dan menyimpan JSON di .evidence/.

```sh
# Masing-masing di terminal sendiri:
ALUR_TRANSPORT=async ALUR_WORK_MS=120 ALUR_NOTIF_MS=300 ALUR_POOL_MAX=4 ALUR_PREFETCH=4 npm run alur:gateway
ALUR_TRANSPORT=async ALUR_WORK_MS=120 ALUR_NOTIF_MS=300 ALUR_POOL_MAX=4 ALUR_PREFETCH=4 npm run alur:validasi
ALUR_TRANSPORT=async ALUR_WORK_MS=120 ALUR_NOTIF_MS=300 ALUR_POOL_MAX=4 ALUR_PREFETCH=4 npm run alur:billing
ALUR_TRANSPORT=async ALUR_WORK_MS=120 ALUR_NOTIF_MS=300 ALUR_POOL_MAX=4 ALUR_PREFETCH=4 npm run alur:notifikasi
ALUR_TRANSPORT=async ALUR_WORK_MS=120 ALUR_NOTIF_MS=300 ALUR_POOL_MAX=4 ALUR_PREFETCH=4 npm run alur:tracking
```

Menit 35–45: ambil tiga angka utama untuk capstone:

| Ukuran | Makna |
|---|---|
| responseP95Ms | p95 dari awal setiap HTTP request sampai receipt; sync 200 selesai, async 202 diterima |
| completionP95Ms | p95 sampai receipt notifikasi diamati di DB; mencakup keterlambatan sampling |
| peakPgSleep | Puncak koneksi DB yang teramati sedang menunggu workload validasi |

Tambahkan accepted/completed/errors dan waktu sampai semua selesai. Sampling 25 ms dapat melewatkan puncak yang lebih pendek. peakDbBusy hanya jumlah query aktif yang tersampel, bukan persentase CPU DB. Jangan mengklaim antrean mengurangi total pekerjaan hanya karena respons HTTP lebih cepat.

Pembanding sinkron menggunakan fungsi efek bisnis dan nilai delay yang sama, dipanggil berurutan dalam satu gateway. Ia bukan demo sinkron empat HTTP service pada hari pertama. Mode async menambah inbox, outbox, relay, dan event fan-out; overhead infrastruktur ini sengaja ikut diukur. Angka bukan perbandingan CPU-bound versus I/O-bound dan bukan klaim kapasitas LNSW.

Klien bersifat **closed loop**: setiap slot menunggu HTTP response sebelum mengirim
request berikutnya. Respons sync membatasi kedatangan request, sedangkan async
menerima batch lebih cepat sehingga backlog internal dapat lebih besar.
Perbedaan completion p95 bukan ukuran latensi intrinsik pada arrival stream
yang identik. Laporkan juga waktu sampai seluruh batch selesai. Waktu tunggu
memperoleh koneksi pool dibatasi 15 detik pada kedua mode.

## Pemeriksaan otomatis dan penilaian

`npm run verify:day4` menjalankan satu pemeriksaan integrasi di project Docker terpisah simpel-day4-qa dengan port 5763/5463/3064. Ia menolak project QA yang sudah ada, tidak membaca .env, dan hanya membersihkan stack QA yang dibuatnya sendiri. Pemeriksaan memerlukan beberapa menit, termasuk dua burst 500. Jangan jalankan bersamaan dengan verify:day3 karena memakai port QA yang sama.

Lulus bila 5a menunjukkan efek idempoten, 5b memulihkan backlog dan membuktikan kompensasi, serta 5c menghasilkan dua berkas bukti dengan 500 completed tanpa error. Jika angka berbeda dari contoh pengajar, jelaskan kondisi uji sebelum menyimpulkan ada kesalahan.

## Batas yang harus disebut saat presentasi

Ketersediaan acceptance bergantung pada DB. Satu node RabbitMQ dan satu Postgres bukan HA. Outbox yang tumbuh perlu kapasitas, pemantauan, dan kebijakan pembersihan. Retry otomatis koneksi bukan restart otomatis proses. Ack/confirm yang hilang tetap dapat memicu redelivery. Inbox harus di-retain selama jendela replay yang disepakati. Status dibaca dari tabel bersama agar kelas ringkas; sistem produksi memerlukan kontrak akses/proyeksi status tersendiri. Keamanan, monitoring, dan operasi DLQ menjadi pembahasan hari kelima.
