# Lab 3 — Producer, Consumer, dan Bukti Pemrosesan

**Modul MP-06 · Hari 3 (Rabu, 16 September 2026) · Praktik 4 JP (180 Menit).**

Target akhir sesi: Gateway mempublish event dengan mekanisme Publisher Confirm; service Validasi memproses data dan menyimpan hasil ke database PostgreSQL sebelum mengirimkan Manual Ack. Peserta membuktikan perilaku sistem ketika consumer mati, menangani redelivery pesan duplikat, serta mengukur dampak nilai prefetch yang berbeda. Seluruh data menggunakan ID sintetis.

---

## Batasan Implementasi Lab 3

Lab ini berfokus pada **lapisan transport pesan** berdasarkan rancangan Lab 2:
- Status HTTP 202 dengan response `DITERIMA_BROKER` menandakan bahwa pesan telah berhasil dirutekan dan dikonfirmasi oleh broker (*publisher confirm*).
- Pada tahap ini, Gateway belum menerapkan Transactional Outbox (Outbox DB akan diimplementasikan penuh di Lab 5).
- Topologi mode `work`: `Gateway` $\rightarrow$ Topic Exchange `simpel.events` $\rightarrow$ Binding `pengajuan.diterima` $\rightarrow$ Queue `validasi.q` $\rightarrow$ satu atau beberapa *competing consumer workers*.
- Pesan dengan kontrak rusak dialihkan ke exchange `simpel.invalid` / routing key `pengajuan.invalid` untuk dikarantina. Mekanisme delayed retry dan DLQ operasional dibahas di Lab 4B.

---

## Prasyarat Lingkungan dan Terminal

Jalankan perintah dari **root repository `simpel-lab/`**, menggunakan Node.js >= 20.6 (mendukung flag `--env-file`), Docker aktif, dan konfigurasi `.env` yang sudah disiapkan:

```bash
docker compose up -d rabbitmq postgres
npm install
npm run db:siapkan
```

> Skrip `npm run db:siapkan` menambahkan tabel-tabel baru tanpa menghapus data yang sudah ada (aman dijalankan pada container yang sudah memiliki data lama).

Siapkan terminal terpisah:
- **Terminal A:** Service Gateway
- **Terminal B, C, D:** Consumer Worker (Validasi)
- **Terminal E:** Pengirim beban request dan pengamat hasil (*evidence*)

Pastikan service demo synchronous lama di port 3001 sudah dimatikan.

---

## 3a — Producer & Publisher Confirm (45 Menit)

*Alokasi waktu: Penjelasan tujuan (5 m) $\rightarrow$ Analisis kontrak (8 m) $\rightarrow$ Tracing kode publish (8 m) $\rightarrow$ Eksekusi (8 m) $\rightarrow$ Uji batas respons HTTP (10 m) $\rightarrow$ Diskusi bukti (6 m).*

1. Buka file [`layanan/gateway/index.js`](../../layanan/gateway/index.js) dan [`layanan/messaging.js`](../../layanan/messaging.js).
   - Bedakan tiga level identitas: identitas bisnis `data.pengajuanId` (contoh: `SIM-001`), identitas event `messageId` (contoh: `evt-001`), dan penelusuran alur `correlationId` (contoh: `corr-001`).
   - Retry atas event yang sama wajib mempertahankan `messageId` yang sama untuk deduplikasi.
2. Di Terminal A, jalankan Gateway dalam mode work:
   ```bash
   SIMPEL_MODE=work npm run broker:gateway
   ```
   Buka `http://127.0.0.1:3001/health` di browser; pastikan mengembalikan `ready: true`. (Biarkan consumer belum berjalan).
3. Di Terminal E, kirim satu pengajuan uji:
   ```bash
   npm run kirim -- --count=1 --run=awal
   ```
   Bukti respons akan dicatat ke `.evidence/awal.json`. Periksa nilai status `confirmed` dan ID yang dihasilkan.
4. Buka RabbitMQ Management UI di vhost Anda $\rightarrow$ tab **Queues** $\rightarrow$ antrean `validasi.q`.
   Perhatikan kolom **Ready** bertambah menjadi 1. Jangan menekan tombol *Get messages* dengan mode *auto-ack* karena akan menghapus pesan uji.
5. Di Terminal E, periksa database:
   ```bash
   npm run hasil -- awal
   ```
   Perintah ini akan menampilkan `validationRows: 0`. Mengapa pesan berstatus confirmed=1 tetapi baris database masih 0? Karena worker belum dinyalakan! Pesan aman tertahan di queue broker.
6. Telusuri implementasi kode: perhatikan penggunaan callback publisher confirm, penanganan event `return` (untuk mendeteksi pesan unroutable saat flag `mandatory: true`), dan nilai return boolean pada fungsi `channel.publish()`. (Nilai boolean ini mengindikasikan apakah buffer internal socket client penuh, bukan konfirmasi dari broker).

---

## 3b — Consumer & Manual Acknowledgment (45 Menit)

*Alokasi waktu: Prediksi alur (5 m) $\rightarrow$ Analisis kode worker (8 m) $\rightarrow$ Eksekusi (8 m) $\rightarrow$ Tracing manual ack (8 m) $\rightarrow$ Simulasi crash & redelivery (10 m) $\rightarrow$ Pembahasan (6 m).*

1. Buka file [`layanan/worker.js`](../../layanan/worker.js). Perhatikan konfigurasi `noAck: false`, pemanggilan `channel.prefetch()`, transaksi `INSERT` ke PostgreSQL, dan pemanggilan `channel.ack(message)`.
2. Di Terminal B, jalankan worker validasi:
   ```bash
   SIMPEL_MODE=work npm run broker:validasi
   ```
   Tunggu hingga log menampilkan status ready. Di Terminal E, jalankan kembali:
   ```bash
   npm run hasil -- awal
   ```
   Nilai `validationRows` kini berubah menjadi 1. Pesan telah sukses diproses dan di-ack.
3. Kirim batch 5 pengajuan normal:
   ```bash
   npm run kirim -- --count=5 --run=normal
   ```
   Cocokkan kelima business ID pada receipts dengan log `committed` di worker terminal B.
4. **Analisis Tiga Jendela Kegagalan (Crash Windows):**
   - Crash *sebelum* INSERT DB: Pesan belum di-ack, broker mendeteksi koneksi putus dan mengirim ulang (*requeue/redeliver*). Data DB bersih.
   - Crash *setelah commit DB tetapi sebelum ack*: Data bisnis sudah tersimpan di DB, tetapi ack hilang. Broker mengirim ulang pesan ke worker lain $\rightarrow$ memicu duplikasi jika consumer tidak idempoten!
   - Crash *setelah ack*: Transaksi tuntas, tidak ada masalah.
5. **Uji Redelivery & Idempotensi Nyata:**
   - Hentikan worker di Terminal B dengan `Ctrl+C`.
   - Jalankan worker dengan penundaan ack artifisial 10 detik:
     ```bash
     VALIDASI_ACK_DELAY_MS=10000 npm run broker:validasi
     ```
   - Di Terminal E, kirim satu pengajuan dengan run ID baru.
   - Segera setelah log menampilkan `committed`, hentikan proses worker tersebut secara paksa (*force kill* PID worker).
   - Jalankan kembali worker normal: amati log worker mendeteksi `redelivered: true` dan `duplicate: true`.
   - Periksa bahwa database tidak menduplikasi baris berkat proteksi `ON CONFLICT (id) DO NOTHING`.

---

## 3c — Uji Ketahanan: Consumer Down, 100 Pesan Tetap Selamat (45 Menit)

*Alokasi waktu: Perumusan hipotesis (5 m) $\rightarrow$ Persiapan baseline (8 m) $\rightarrow$ Publish 100 pesan saat worker mati (8 m) $\rightarrow$ Monitoring queue depth (8 m) $\rightarrow$ Pemulihan worker & rekonsiliasi ID (10 m) $\rightarrow$ Kesimpulan (6 m).*

1. Hentikan seluruh worker validasi dengan `Ctrl+C`. Biarkan Gateway tetap menyala.
2. Pastikan metrik **Consumers** pada antrean `validasi.q` bernilai 0 di Management UI.
3. Kirim lonjakan beban 100 pengajuan sekaligus saat consumer offline:
   ```bash
   npm run kirim -- --count=100 --run=mati01
   ```
4. Di Management UI, amati angka **Ready** melonjak menjadi 100. Jalankan `npm run hasil -- mati01`; hasilnya membuktikan 0 baris di database. Gateway tetap membalas HTTP 202 ke klien.
5. Nyalakan kembali worker validasi di Terminal B:
   ```bash
   npm run broker:validasi
   ```
   Amati antrean terkuras habis secara bertahap (*drain*).
6. Verifikasi integritas data:
   ```bash
   npm run hasil -- mati01
   ```
   Hasilnya wajib menunjukkan angka 100 baris. Seluruh 100 pesan yang dikirim saat service worker mati berhasil dipulihkan dan diproses tanpa ada satu pun ID yang hilang.

---

## 3d — Competing Consumers: Prefetch 1 vs Prefetch 100 (45 Menit)

*Alokasi waktu: Setup variabel (5 m) $\rightarrow$ Eksperimen Prefetch 1 (8 m) $\rightarrow$ Pencatatan metrik (8 m) $\rightarrow$ Eksperimen Prefetch 100 (8 m) $\rightarrow$ Komparasi & analisis bottleneck (10 m) $\rightarrow$ Kesimpulan teknis (6 m).*

Uji coba ini menggunakan simulasi beban I/O database: `VALIDASI_KERJA_MS=120` dengan koneksi pool PostgreSQL dibatasi maksimal 4 per worker.

### Eksperimen 1: Fair Dispatch (Prefetch = 1)

Jalankan 3 worker competing consumers di Terminal B, C, dan D dengan prefetch 1:

```bash
# Terminal B:
WORKER_ID=w1 VALIDASI_PREFETCH=1 VALIDASI_POOL_MAX=4 npm run broker:validasi
# Terminal C:
WORKER_ID=w2 VALIDASI_PREFETCH=1 VALIDASI_POOL_MAX=4 npm run broker:validasi
# Terminal D:
WORKER_ID=w3 VALIDASI_PREFETCH=1 VALIDASI_POOL_MAX=4 npm run broker:validasi
```

Di Terminal E, kirim 120 pesan:
```bash
npm run kirim -- --count=120 --run=p1
```
Tunggu hingga seluruh pesan selesai, lalu amati metrik ringkasan pada log akhir worker (`received per worker`, `maxInFlight`, `maxPoolWaiting`).

### Eksperimen 2: Greedy Dispatch (Prefetch = 100)

Hentikan ketiga worker, lalu jalankan kembali dengan prefetch 100:

```bash
# Terminal B:
WORKER_ID=w1 VALIDASI_PREFETCH=100 VALIDASI_POOL_MAX=4 npm run broker:validasi
# Terminal C:
WORKER_ID=w2 VALIDASI_PREFETCH=100 VALIDASI_POOL_MAX=4 npm run broker:validasi
# Terminal D:
WORKER_ID=w3 VALIDASI_PREFETCH=100 VALIDASI_POOL_MAX=4 npm run broker:validasi
```

Kirim kembali 120 pesan dengan run ID `p100`:
```bash
npm run kirim -- --count=120 --run=p100
```

### Tabel Komparasi Hasil Eksperimen

| Metrik Evaluasi | Prefetch = 1 | Prefetch = 100 |
|---|---|---|
| Total waktu penyelesaian (*elapsed time*) | *(catat hasil)* | *(catat hasil)* |
| Distribusi beban antar worker (w1 / w2 / w3) | Rata (~40 / ~40 / ~40) | Cenderung timpang |
| Puncak pesan in-flight per worker | Maksimal 1 per worker | Hingga 100 menumpuk di memori worker |
| Antrean koneksi database (*pool waiting*) | Terkendali (<= pool max) | Berisiko pool starvation |

> **Prinsip Teknis:** Nilai `prefetch` membatasi jumlah pesan yang belum di-ack yang boleh dikirim broker ke satu worker. Nilai prefetch rendah (misalnya 1–10) menjamin pembagian beban yang adil (*fair dispatch*) pada tugas berat, sedangkan prefetch tinggi cocok untuk pesan ringan berkecepatan tinggi dengan pemrosesan CPU murni.

---

## Verifikasi Otomatis untuk Evaluasi

Tersedia skrip pengujian menyeluruh untuk memvalidasi seluruh fungsionalitas Lab 3:

```bash
npm run verify:day3
```

Skrip ini menjalankan suite pengujian terisolasi (stack QA terpisah) untuk memeriksa publisher confirm, recovery consumer mati, deduplikasi pesan, hingga verifikasi prefetch.

Rujukan teknis: [amqplib Channel API Guide](https://amqp-node.github.io/amqplib/channel_api.html), [RabbitMQ Confirms](https://www.rabbitmq.com/docs/confirms), dan [Consumer Prefetch](https://www.rabbitmq.com/docs/consumer-prefetch).
