# Lab 5 — Integrasi End-to-End SIMPEL & Uji Beban

**Modul MP-08 · Hari 4 (Kamis, 17 September 2026) · Praktik 3 JP (135 Menit).**

MP-08 merupakan puncak integrasi alur bisnis SIMPEL secara menyeluruh: menghubungkan Gateway, Validasi, Billing, Notifikasi, dan Tracking menggunakan **Transactional Outbox Pattern**, **Inbox Deduplication**, serta mekanisme **Kompensasi Pembatalan**.

Seluruh latihan dijalankan dari root direktori `simpel-lab/` menggunakan Node.js >= 20.6. Semua data dan entitas yang digunakan bersifat sintetis.

---

## Persiapan Environment

Jalankan database dan broker lokal, lalu perbarui skema tabel integrasi:

```bash
docker compose up -d rabbitmq postgres
npm install
npm run db:siapkan
```

> Perintah `npm run db:siapkan` menambahkan tabel-tabel alur integrasi (`alur_pengajuan`, `alur_outbox`, `alur_inbox`, `alur_tracking`) tanpa menghapus data latihan hari sebelumnya.

Implementasi alur end-to-end berada di file [`layanan/alur.js`](../../layanan/alur.js) dengan antrean berawalan `alur.*`. Jalankan kelima service di terminal terpisah:

| Service / Peran | Perintah Eksekusi di Terminal | Tanggung Jawab Alur |
|---|---|---|
| **Gateway + Outbox Relay** | `npm run alur:gateway` | Menerima HTTP POST, tulis DB + outbox atomik, kirim HTTP 202 |
| **Validasi + Relay** | `npm run alur:validasi` | Verifikasi berkas, cadangkan alur, publish `pengajuan.valid` |
| **Billing + Relay** | `npm run alur:billing` | Terbitkan kode bayar, simulasi payment partner, publish `billing.terbit` |
| **Notifikasi + Relay** | `npm run alur:notifikasi` | Simulasi pengiriman tanda terima (receipt DB), selesaikan workflow |
| **Tracking** | `npm run alur:tracking` | Simpan audit log seluruh event (`pengajuan.*`, `billing.*`) |

*Konfigurasi default:* `ALUR_WORK_MS=120`, `ALUR_NOTIF_MS=300`, `ALUR_POOL_MAX=4`, `ALUR_PREFETCH=1`, dan `ALUR_TRANSPORT=async`.

---

## Lab 5a — Alur End-to-End, Polling Status, & Idempotensi (45 Menit)

*Alokasi waktu: Start 5 proses (10 m) → Kirim pengajuan & polling status (15 m) → Uji idempotensi request duplikat (10 m) → Verifikasi audit trail DB (10 m).*

1. **Jalankan 5 Service:** Pastikan kelima service menyala di terminal masing-masing. Buka `http://127.0.0.1:3001/health` di browser; pastikan mengembalikan `ready: true` (koneksi DB sehat) dan `brokerReady: true` (koneksi RabbitMQ terhubung).
2. **Kirim Pengajuan Asinkron:**
   Simulasikan pengiriman pengajuan izin melalui script berikut atau REST client:

   ```javascript
   const base = 'http://127.0.0.1:3001';
   const response = await fetch(base + '/pengajuan', {
     method: 'POST',
     headers: {
       'content-type': 'application/json',
       'Idempotency-Key': 'kelas-001'
     },
     body: JSON.stringify({
       pemohon: 'Budi Santoso',
       jenis: 'siup',
       kantor: 'jakarta'
     })
   });

   const receipt = await response.json();
   console.log('HTTP Status:', response.status, receipt);
   // Respons langsung 202 Accepted dengan URL status pelacakan:
   console.log('Status Terkini:', await (await fetch(base + receipt.statusUrl)).json());
   ```

3. **Polling Status URL:**
   Lakukan polling ke `statusUrl` secara berkala hingga mencapai status terminal `SELESAI`. Tahapan status yang dilalui: `DITERIMA` → `VALID` → `BILLING_TERBIT` → `SELESAI`.
4. **Uji Idempotensi Request Gateway:**
   - Kirim ulang request dengan `Idempotency-Key` yang sama persis: Gateway langsung mengembalikan respons yang sama dengan `pengajuanId` yang identik tanpa membuat pengajuan ganda.
   - Ubah isi payload (misalnya ganti `jenis: 'nib'`) namun tetap memakai `Idempotency-Key: 'kelas-001'`: Gateway dengan tegas menolak dengan status `HTTP 409 Conflict`.
5. **Verifikasi Integritas Data di PostgreSQL:**
   Jalankan query SQL di terminal:
   ```sql
   SELECT layanan, count(*) FROM alur_inbox GROUP BY layanan;
   SELECT event, count(*) FROM alur_tracking GROUP BY event;
   SELECT owner, count(*) FROM alur_outbox WHERE published_at IS NULL GROUP BY owner;
   ```
   - Service Tracking mencatat 4 event lengkap untuk alur normal (`pengajuan.diterima`, `pengajuan.valid`, `billing.terbit`, `pengajuan.selesai`).
   - Seluruh baris outbox telah berhasil dipublish dan ditandai (`published_at` terisi).
   - Tabel `alur_inbox` memastikan setiap worker consumer hanya memproses event yang sama satu kali (*at-most-once processing effect*).

---

## Lab 5b — Simulasi Downtime Billing & Kompensasi Pembatalan (45 Menit)

*Alokasi waktu: Matikan billing saat traffic masuk (15 m) → Recovery billing & drain antrean (10 m) → Fault injection uji gagal & saga kompensasi (10 m) → Pembahasan arsitektur (10 m).*

1. **Simulasi Downtime Billing:**
   - Hentikan hanya service Billing di terminalnya (`Ctrl+C`).
   - Kirim beberapa pengajuan baru via HTTP POST.
   - Amati: Gateway tetap membalas `HTTP 202 Accepted`! Di database tracking, status berhenti di `VALID`. Antrean `alur.billing.q` di RabbitMQ Management UI menumpuk pesan.
2. **Pemulihan Service:**
   - Nyalakan kembali service Billing: `npm run alur:billing`.
   - Amati: Tanpa perlu intervensi manual atau pengiriman ulang dari klien, antrean billing langsung terkuras otomatis dan status permohonan berlanjut hingga `SELESAI`.
3. **Simulasi Kegagalan Bisnis & Kompensasi (Fault Injection):**
   - Kirim permohonan dengan jenis perizinan khusus: `uji-gagal`.
   - Service Billing mendeteksi kegagalan permanen: setelah mencoba retry berjadwal (3 attempt via outbox ke antrean retry), pesan masuk ke `alur.billing.dlq` dan service Billing mempublish event kegagalan: `billing.gagal`.
   - Service Validasi menangkap event `billing.gagal`, lalu menjalankan **tindakan kompensasi**: mengubah status reservasi kuota dari `reserved` menjadi `cancelled`, lalu mempublish event kompensasi `pengajuan.dibatalkan`.
   - Status akhir permohonan tercatat sebagai `DIBATALKAN` di audit log.

> **Poin Pembelajaran Teknis:** Kompensasi bukanlah rollback database ajaib lintas jaringan. Kompensasi adalah **transaksi bisnis baru ke arah depan** untuk menetralkan efek transaksi sebelumnya secara sah dan tercatat di audit trail.

---

## Lab 5c — Uji Beban Burst 500: Dua Jam Pengukuran (45 Menit)

*Alokasi waktu: Pengaturan parameter benchmark (5 m) → Uji beban mode Synchronous (15 m) → Uji beban mode Asynchronous (15 m) → Komparasi metrik p95 & analisis kapasitas (10 m).*

Eksperimen ini membandingkan langsung performa **mode Synchronous** versus **mode Asynchronous** pada beban berat: **500 request perizinan dengan 50 konkurensi paralel** menggunakan script pembanding terkontrol `tools/beban-alur.js`.

### 1. Benchmark Mode Synchronous
Hentikan kelima service async. Jalankan gateway dalam mode synchronous (memproses validasi, billing, dan notifikasi secara serial dalam satu panggilan HTTP):

```bash
# Terminal A:
ALUR_TRANSPORT=sync ALUR_WORK_MS=120 ALUR_NOTIF_MS=300 ALUR_POOL_MAX=4 npm run alur:gateway

# Terminal B (Jalankan pengujian beban):
node --env-file=.env tools/beban-alur.js
```

Catat metrik yang dihasilkan di akhir pengujian.

### 2. Benchmark Mode Asynchronous
Hentikan gateway sync. Nyalakan kembali kelima service async dengan parameter beban identik (`ALUR_PREFETCH=4`):

```bash
# Terminal terpisah:
ALUR_TRANSPORT=async ALUR_WORK_MS=120 ALUR_NOTIF_MS=300 ALUR_POOL_MAX=4 ALUR_PREFETCH=4 npm run alur:gateway
ALUR_TRANSPORT=async ALUR_WORK_MS=120 ALUR_NOTIF_MS=300 ALUR_POOL_MAX=4 ALUR_PREFETCH=4 npm run alur:validasi
ALUR_TRANSPORT=async ALUR_WORK_MS=120 ALUR_NOTIF_MS=300 ALUR_POOL_MAX=4 ALUR_PREFETCH=4 npm run alur:billing
ALUR_TRANSPORT=async ALUR_WORK_MS=120 ALUR_NOTIF_MS=300 ALUR_POOL_MAX=4 ALUR_PREFETCH=4 npm run alur:notifikasi
ALUR_TRANSPORT=async ALUR_WORK_MS=120 ALUR_NOTIF_MS=300 ALUR_POOL_MAX=4 ALUR_PREFETCH=4 npm run alur:tracking
```

Jalankan script pengujian beban sekali lagi:
```bash
node --env-file=.env tools/beban-alur.js
```

### Matriks Perbandingan Dua Jam Ukur

| Metrik Evaluasi | Mode Synchronous (HTTP Serial) | Mode Asynchronous (RabbitMQ + Outbox) |
|---|---|---|
| **Response Time (p95)** | Sangat tinggi (~3.500 ms) karena menahan koneksi hingga notifikasi usai | Sangat cepat (~2–5 ms), gateway langsung membalas HTTP 202 |
| **Completion Time (p95)** | Sama dengan Response Time (~3.500 ms) | Bertahap (~waktu pengurasan antrean di worker) |
| **Koneksi Database Terpakai** | Koneksi menggantung lama menunggu I/O pihak ketiga | Koneksi dipakai efisien hanya saat transaksi commit lokal |
| **Ketahanan terhadap Spike** | Risiko HTTP 504 Gateway Timeout dan kehabisan pool | Antrean broker menahan lonjakan beban (*load leveling*) |

---

## Verifikasi Otomatis Lab 5

Untuk memvalidasi keseluruhan alur Lab 5 secara otomatis, jalankan:

```bash
npm run verify:day4
```

Skrip ini menjalankan container QA terpisah untuk menguji alur idempoten, pemulihan antrean saat downtime, eksekusi kompensasi saga, serta dua kali pengujian burst 500 tanpa error.

Rujukan teknis: [Transactional Outbox Pattern](https://microservices.io/patterns/data/transactional-outbox.html) dan [Saga Pattern](https://microservices.io/patterns/data/saga.html).
