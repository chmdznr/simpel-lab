# Lab 5 — Lembar Laporan Praktik Integrasi Microservices & Uji Beban (Contoh Terisi Lengkap 5a, 5b, & 5c)

**Modul MP-08 · Hari 4 (Kamis, 17 September 2026) · Praktik 3 JP (135 Menit)**  
**Instrumen Penilaian Nilai Tugas (NT) · Bobot Modul: 14,3% (Maksimal 10 Poin)**

---

**Identitas Peserta:**
- **Nama Peserta:** Achmad Zaenuri (Contoh Hasil Praktik Lengkap Lab 5)
- **NIP / Kode Peserta:** PJJ-SIMPEL-01
- **Virtual Host / Alamat Broker:** `amqp://simpel:simpel123@127.0.0.1:5672` (vhost `/`)
- **Tanggal Praktik:** 17 September 2026

---

### Rubrik Penilaian (Total: 10 Poin)

| Komponen Bukti | Bagian Praktik | Poin | Deskripsi Kriteria Kelulusan |
|---|---|:---:|---|
| **1. Alur End-to-End & Idempotensi Gateway** | Lab 5a | 3 | Bukti alur lengkap 5 service berjalan, polling status mencapai `SELESAI`, bukti konsistensi data di 4 tabel (`alur_pengajuan`, `alur_outbox`, `alur_inbox`, `alur_tracking`), serta penolakan HTTP 409 saat reuse key dengan payload berbeda. *(Terisi Lengkap · Skor Maksimal: 3 Poin)* |
| **2. Downtime Billing & Saga Kompensasi** | Lab 5b | 3 | Bukti ketahanan saat service Billing down (HTTP 202 tetap terbit, backlog menampung di broker), pemulihan otomatis saat Billing start, dan eksekusi kompensasi Saga saat fault injection `uji-gagal` (reservasi dibatalkan). *(Terisi Lengkap · Skor Maksimal: 3 Poin)* |
| **3. Komparasi Uji Beban Burst 500 (Dua Jam Ukur)** | Lab 5c | 4 | Tabel perbandingan metrik 500 request (Sync vs Async: p95 response time, p95 completion time, utilisasi DB pool) terisi lengkap disertai analisis arsitektural keunggulan asinkron. *(Terisi Lengkap · Skor Maksimal: 4 Poin)* |
| **Total Nilai Tugas Lab 5** | | **10** | **Konversi Bobot: 14,3% NT (Skor Sempurna: 10/10)** |

---

## BAGIAN 1: Lab 5a — Alur End-to-End, Polling Status, & Idempotensi (3 Poin)

### 1.1 Bukti Respons Gateway & Polling Status
Klien mengirimkan request pengajuan izin baru via HTTP POST ke endpoint Gateway dengan header `Idempotency-Key: kelas-001`.

1. **Respons Awal Gateway (HTTP 202 Accepted):**
```json
{
  "status": "DITERIMA",
  "pengajuanId": "SIM-9bf99c5d5f0baabd39f23b23b7f4783e",
  "correlationId": "corr-e44853ab-d6a9-42a4-a6fc-0985c729a4d2",
  "statusUrl": "/pengajuan/SIM-9bf99c5d5f0baabd39f23b23b7f4783e"
}
```
*Catatan Durasi:* Gateway membalas secara instan dalam **72,97 ms** karena pemrosesan berat dialihkan ke antrean asinkron.

2. **Perjalanan Status Permohonan Hasil Polling ke `statusUrl`:**
- Status 1: `DITERIMA` (Waktu: +0 ms — gateway outbox merekam pengajuan)
- Status 2: `VALID` (Waktu: +265 ms — worker validasi menyelesaikan cek berkas dan kuota `reserved`)
- Status 3: `BILLING_TERBIT` (Waktu: +376 ms — worker billing menerbitkan kode pembayaran `BIL-SIM-9bf99c5d5f0baabd39f23b23b7f4783e`)
- Status Akhir: `SELESAI` (Waktu: +721 ms — worker notifikasi mencatat bukti receipt)

**Respons Akhir Terminal State (Polling Selesai):**
```json
{
  "id": "SIM-9bf99c5d5f0baabd39f23b23b7f4783e",
  "correlation_id": "corr-e44853ab-d6a9-42a4-a6fc-0985c729a4d2",
  "status": "SELESAI"
}
```

---

### 1.2 Verifikasi Konsistensi Data di PostgreSQL
Hasil query SQL pada keempat tabel audit dan integrasi:

```sql
SELECT layanan, count(*) FROM alur_inbox GROUP BY layanan ORDER BY layanan;
SELECT event, count(*) FROM alur_tracking GROUP BY event ORDER BY event;
SELECT owner, count(*) FROM alur_outbox WHERE published_at IS NULL GROUP BY owner;
```

**Hasil Eksekusi Query:**

```text
[Tabel alur_inbox: Deduplikasi Pesan di Consumer]
 layanan    | count
------------+-------
 billing    |     1
 notifikasi |     1
 tracking   |     4
 validasi   |     1

[Tabel alur_tracking: Audit Trail Event Bisnis]
         event         | count
-----------------------+-------
 billing.terbit        |     1
 notifikasi.terkirim   |     1
 pengajuan.diterima    |     1
 validasi.selesai      |     1

[Tabel alur_outbox: Pending Messages]
(0 rows) -> SEMUA event outbox (100%) berstatus published (published_at IS NOT NULL)

[Rincian Baris Outbox Terbit]
 owner      | routing_key           | is_published
------------+-----------------------+--------------
 gateway    | pengajuan.diterima    | true
 validasi   | validasi.selesai      | true
 billing    | billing.terbit        | true
 notifikasi | notifikasi.terkirim   | true
```

*Verifikasi Outbox & Inbox:*
- Apakah ada baris di `alur_outbox` yang memiliki `published_at IS NULL`? (Harus 0 / semua ter-publish): **0 (Nol)**. Semua baris outbox telah berhasil dipublish dan di-ack oleh broker.
- Mengapa tabel `alur_inbox` diperlukan pada masing-masing consumer?  
  *Jawaban:* Pada arsitektur pesan terdistribusi dengan garansi *at-least-once delivery*, broker dapat mengirimkan ulang (*redelivery*) pesan yang sama (misalnya saat worker mati mendadak setelah menyelesaikan transaksi SQL tetapi sebelum mengirimkan pesan ack ke broker). Tabel `alur_inbox` mencatat `message_id` yang sudah pernah dieksekusi dalam transaksi atomik lokal bersama logika bisnisnya. Jika pesan duplikat tiba, consumer mendeteksi pelanggaran unik di `alur_inbox`, mengabaikan eksekusi ulang bisnis (*skip*), dan langsung mengirimkan ack. Ini menjamin efek eksekusi bersifat tepat satu kali (*at-most-once processing effect*).

---

### 1.3 Uji Idempotensi Request Gateway

1. **Pengiriman Ulang dengan Idempotency-Key & Payload Sama:**
   - Parameter: `Idempotency-Key: kelas-001`, body tetap `{"pemohon": "Budi Santoso", "jenis": "siup", "kantor": "jakarta"}`.
   - Status HTTP: **HTTP 202 Accepted**
   - Body Output: `{"pengajuanId":"SIM-9bf99c5d5f0baabd39f23b23b7f4783e","correlationId":"corr-e44853ab-d6a9-42a4-a6fc-0985c729a4d2","status":"DITERIMA","statusUrl":"/pengajuan/SIM-9bf99c5d5f0baabd39f23b23b7f4783e"}`
   - Apakah `pengajuanId` yang dikembalikan identik?: **Ya** (`SIM-9bf99c5d5f0baabd39f23b23b7f4783e`).
   - Apakah database membuat baris pengajuan ganda?: **Tidak**. Tabel `alur_pengajuan` tetap memiliki tepat 1 baris karena kolom `request_key` memiliki konstrain `UNIQUE`.

2. **Pengiriman Ulang dengan Idempotency-Key Sama tetapi Payload Berbeda:**
   - Parameter: `Idempotency-Key: kelas-001`, body diubah menjadi `{"pemohon": "Budi Santoso", "jenis": "nib", "kantor": "jakarta"}`.
   - Status HTTP: **HTTP 409 Conflict**
   - Pesan Error:
```json
{
  "error": "Idempotency-Key was used for a different payload"
}
```
   - *Penjelasan Teknis:* Gateway mendeteksi bahwa kunci idempotensi yang sama mencoba mengirimkan entitas bisnis yang berbeda. Untuk menjaga integritas data dan mencegah keracunan state (*state corruption*), request ditolak secara tegas dengan kode 409.

---

## BAGIAN 2: Lab 5b — Simulasi Downtime Billing & Kompensasi Saga (3 Poin)

### 2.1 Ketahanan Sistem saat Service Billing Mati
Simulasi downtime dilakukan dengan mematikan service Billing (`Ctrl+C`), sementara service Gateway, Validasi, Notifikasi, dan Tracking tetap aktif. Klien kemudian mengirimkan pengajuan baru dengan header `Idempotency-Key: lab5b-down-001`.

1. **Respons Gateway ke Klien:**  
   Apakah Gateway tetap mengembalikan `HTTP 202 Accepted` meskipun service Billing mati?  
   *Jawaban:* **Ya, tetap mengembalikan HTTP 202 Accepted**.  
   *Latensi respons:* **69,18 ms**.  
   *Bukti Payload Respons:*
```json
{
  "pengajuanId": "SIM-56f0913f348d4c0d48fa6b6a939a2864",
  "correlationId": "corr-70754dfc-4c2d-47ff-9e11-ff56502148a5",
  "status": "DITERIMA",
  "statusUrl": "/pengajuan/SIM-56f0913f348d4c0d48fa6b6a939a2864"
}
```

2. **Posisi Antrean di RabbitMQ Management UI & Database Tracking:**  
   - Jumlah pesan Ready di antrean `alur.billing.q`: **1 pesan** (antrean menampung event `validasi.selesai` secara aman tanpa ada data yang hilang).
   - Status terakhir permohonan di tabel tracking dan status URL: **`VALID`** (permohonan tertahan sementara menunggu worker Billing hidup kembali).

---

### 2.2 Pemulihan Service Billing (Automatic Drain)
Service Billing dinyalakan kembali (`npm run alur:billing`) tanpa campur tangan dari sisi klien.

1. **Perilaku Sistem:**  
   Apakah klien perlu mengirim ulang request agar permohonan selesai?  
   *Jawaban:* **Tidak perlu mengirim ulang sama sekali**. Begitu service Billing aktif, ia langsung mengonsumsi (*drain*) pesan backlog dari antrean `alur.billing.q`. Antrean `alur.billing.q` seketika berkurang dari 1 menjadi **0 pesan**.
2. **Status Akhir di Database Tracking:**  
   Status permohonan bergerak otomatis dari `VALID` $\rightarrow$ `BILLING_TERBIT` (+806 ms) $\rightarrow$ tuntas menjadi **`SELESAI`** (+1.237 ms) dengan kode bayar dan notifikasi terbit sempurna.

---

### 2.3 Simulasi Kegagalan Bisnis & Kompensasi Saga (Fault Injection)
Pengujian fault injection disimulasikan dengan mengirimkan pengajuan yang memiliki atribut khusus `jenis: 'uji-gagal'` dengan header `Idempotency-Key: lab5b-gagal-001`.

1. **Alur Karantina & Deteksi Kegagalan:**  
   - Service Validasi meloloskan dokumen dan mencatat reservasi kuota `reserved` di tabel `alur_validasi`.
   - Service Billing menerima event `validasi.selesai`, namun mendeteksi kegagalan permanen (*Synthetic permanent billing failure*).
   - Billing melakukan mekanisme retry berjadwal melalui exchange `alur.retry`:
     - **Attempt 1:** Gagal $\rightarrow$ dijadwalkan ulang dengan delay 2 detik.
     - **Attempt 2:** Gagal $\rightarrow$ dijadwalkan ulang dengan delay 2 detik.
     - **Attempt 3:** Gagal $\rightarrow$ batas attempt tercapai (*terminal failure*).
   - Pesan gagal secara otomatis dialihkan ke antrean karantina: **`alur.billing.dlq`** (Dead Letter Queue terisi **1 pesan**).
   - Service Billing mem-publish event kegagalan bisnis: **`billing.gagal`**.

2. **Tindakan Kompensasi oleh Service Validasi:**  
   - Service Validasi menangkap event `billing.gagal` dari broker.
   - Validasi mengeksekusi kompensasi atomik: status reservasi kuota di tabel `alur_validasi` diubah dari `'reserved'` menjadi **`'cancelled'`**.
   - Service Validasi menerbitkan event kompensasi: **`pengajuan.dibatalkan`**.
   - Status terminal permohonan tercatat resmi sebagai **`DIBATALKAN`** (+4.680 ms dari penerimaan awal).

**Bukti Verifikasi Database Pasca Kompensasi Saga:**
```text
[Tabel alur_validasi: Status Reservasi Terkompensasi]
 pengajuan_id                           | status
----------------------------------------+-----------
 SIM-ccfbaef266b38775175bbe4a539a47a5   | cancelled

[Tabel alur_billing: Kode Bayar]
(0 rows) -> Kode pembayaran TIDAK terbit sama sekali.

[Tabel alur_tracking: Jejak Audit Lengkap Kompensasi]
 message_id   | event
--------------+-----------------------
 evt-SIM-...  | pengajuan.diterima
 evt-80ee...  | validasi.selesai
 evt-c1ea...  | billing.gagal
 evt-2a11...  | pengajuan.dibatalkan
```

3. **Refleksi Teknis:** Mengapa kompensasi pada arsitektur terdistribusi bukanlah rollback transaksi SQL langsung melainkan transaksi bisnis baru ke arah depan (*forward transaction*)?  
   *Jawaban:*  
   Pada arsitektur microservices terdistribusi dengan prinsip *Database-per-Service*, setiap layanan mengelola databasenya secara otonom. Transaksi di Service Validasi telah berhasil di-*commit* ke basis data lokal beberapa detik sebelum Service Billing mengalami kegagalan.  
   Melakukan *rollback global* (seperti protokol *Two-Phase Commit* / 2PC) akan memblokir tabel database lintas jaringan, memunculkan ketergantungan yang rapuh (*tight coupling*), serta menurunkan ketersediaan sistem secara drastis (melanggar teorema CAP).  
   Oleh karena itu, pola **Saga (Choreography)** menggunakan **kompensasi semantik ke arah depan (*compensating transaction*)**: mengeksekusi aksi bisnis baru yang sah (seperti mengubah status kuota menjadi `cancelled` atau menerbitkan nota kredit pembatalan) untuk menetralkan dampak bisnis transaksi sebelumnya, dengan seluruh jejak audit tetap utuh dan transparan.

---

## BAGIAN 3: Lab 5c — Komparasi Uji Beban Burst 500 (Dua Jam Pengukuran · 4 Poin)

### 3.1 Tabel Hasil Pengujian Beban 500 Request (50 Konkurensi Paralel)
Pengujian beban terkontrol dijalankan menggunakan script `tools/beban-alur.js` pada mode Synchronous (HTTP serial) dan mode Asynchronous (RabbitMQ + Transactional Outbox) dengan parameter identik: 500 request, 50 konkurensi, `ALUR_WORK_MS=120`, `ALUR_NOTIF_MS=300`, dan `ALUR_POOL_MAX=4`:

| Parameter & Metrik Pengukuran | Mode Synchronous (HTTP Serial) | Mode Asynchronous (RabbitMQ + Outbox) |
|---|:---:|:---:|
| **Total Request Dikirim** | 500 | 500 |
| **Request Berhasil Selesai** | 500 | 500 |
| **Error / Timeout (HTTP 500 / 504)** | 0 | 0 |
| **HTTP Response Time (p95)** | **21.381 ms** | **638 ms** |
| **Workflow Completion Time (p95)** | **21.405 ms** | **77.952 ms** |
| **Puncak Koneksi DB Sleep (`peakPgSleep`)** | **4** | **4** |
| **Puncak Koneksi DB Aktif (`peakDbBusy`)** | **4** | **15** |
| **Total Durasi Pengujian (Wall Time)** | 108.879 ms (~109 dtk) | 89.079 ms (~89 dtk) |

---

### 3.2 Analisis Teknis & Prinsip Dua Jam Pengukuran

1. **Mengapa nilai HTTP Response Time p95 pada mode Asinkron (~638 ms) jauh lebih cepat daripada mode Sinkron (~21.381 ms)?**  
   *Analisis:*  
   Pada mode Synchronous, koneksi HTTP bersifat memblokir (*blocking socket*). Klien harus menunggu seluruh tahapan serial selesai dalam satu panggilan HTTP: verifikasi validasi (120 ms) + reservasi database + penerbitan billing + notifikasi (300 ms) + pencatatan audit. Dengan 50 konkurensi paralel yang berebut 4 koneksi pool database, antrean panggilan menumpuk di memori Express/Node.js, mengakibatkan latensi p95 meroket hingga **21,38 detik** per request.  
   Sebaliknya, pada mode Asynchronous dengan Transactional Outbox, Gateway hanya menjalankan satu transaksi lokal yang sangat ringkas: menyimpan data ke tabel `alur_pengajuan` dan event ke tabel `alur_outbox`, lalu seketika membalas **HTTP 202 Accepted** ke klien. Klien langsung terbebas dalam hitungan milidetik, sementara beban pemrosesan berat didelegasikan ke antrean broker di latar belakang.

2. **Mengapa nilai Completion Time p95 pada mode Asinkron tetap memakan waktu hingga puluhan detik? Jelaskan konsep "Dua Jam Pengukuran"!**  
   *Analisis:*  
   Perilaku ini mendemonstrasikan prinsip dasar **Dua Jam Pengukuran (*Two-Clocks Model*)**:
   - **Jam Penerimaan (Acceptance Clock / Response Time):** Mengukur seberapa cepat sistem memberikan kepastian hukum tanda terima (*receipt*) kepada klien. Jam ini berhenti begitu respons HTTP 202 terkirim. Pada mode asinkron, jam ini berdetak sangat kencang (**p95: 638 ms**).
   - **Jam Penyelesaian (Completion Clock / Processing Time):** Mengukur durasi aktual komputasi fisik dan I/O bisnis hingga tahap akhir notifikasi terselesaikan. Jam ini tetap membutuhkan waktu riil karena 500 permohonan harus melalui latensi I/O wajib (500 x 420 ms I/O) yang dikonsumsi oleh 4 worker paralel secara berurutan.  
   RabbitMQ berfungsi sebagai **peredam kejut (*shock absorber / load leveler*)**: lonjakan 500 request diserap seketika di buffer antrean broker, lalu dikuras (*drained*) secara bertahap dan teratur sesuai kapasitas daya tampung worker dan database.

3. **Berdasarkan metrik `peakPgSleep` dan koneksi database, mengapa mode Asinkron dengan batas pool `ALUR_POOL_MAX=4` dan `ALUR_PREFETCH=4` mampu mencegah insiden database crash / connection exhaustion di lingkungan produksi?**  
   *Analisis:*  
   Pada mode Synchronous, jika terjadi lonjakan trafik ribuan request, setiap panggilan HTTP yang menggantung akan menahan koneksi database selama ratusan milidetik. Koneksi pool cepat habis (*connection pool exhaustion*), memicu penolakan koneksi database, lonjakan memori, dan kegagalan kaskade (*cascading failures*) HTTP 504 Gateway Timeout.  
   Pada mode Asynchronous, antrean broker memisahkan secara tegas (*decouples*) antara laju penerimaan request dari pengguna dengan laju eksekusi transaksi database. Pengaturan **`ALUR_PREFETCH=4`** dan **`ALUR_POOL_MAX=4`** memberlakukan mekanisme **kendali tekanan balik (*backpressure control*)**:
   - Broker hanya mengirimkan maksimal 4 pesan ke setiap worker yang sedang aktif.
   - Worker hanya membuka transaksi database saat data siap diproses secara lokal (bukan saat menggantung menunggu jaringan luar).
   - Beban database dibatasi secara mutlak pada ambang batas aman (`peakPgSleep = 4`), sehingga database PostgreSQL tetap beroperasi stabil tanpa pernah kehabisan koneksi (*connection starvation*) atau crash kehabisan RAM.

---

## BAGIAN 4: Verifikasi Otomatis (`verify:day4`)

Hasil eksekusi verifikasi otomatis menggunakan rangkaian uji integrasi menyeluruh:
```bash
npm run verify:day4
```

**Bukti Lulus Uji Otomatis:**
```text
PASS topic copies and alternate exchange match the prediction matrix
PASS retry waits twice, stops at attempt 3, and replays the same ID after repair
PASS concurrent HTTP idempotency key reuse creates one submission; conflicting payload returns 409
PASS five roles complete; tracking and validation deduplicate independently
PASS two competing validation processes and repeated copies create one next event
PASS billing process outage accepts 20 submissions and catches up after restart without HTTP resubmission
PASS permanent billing failure reaches terminal DLQ and releases the validation reservation
PASS consumer crash after commit produces one durable notification receipt
PASS failed DB effect rolls back inbox; delayed retry succeeds after table recovery
PASS database-backed acceptance survives broker outage; relays and consumers reconnect automatically
PASS controlled 500-request comparisons
PASS runtime
```

- Status Verifikasi Otomatis: **PASS (12/12 Skenario Pengujian Lulus Sempurna)**
