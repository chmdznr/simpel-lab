# Lab 5 — Lembar Laporan Praktik Integrasi Microservices & Uji Beban (Contoh Terisi Lab 5a)

**Modul MP-08 · Hari 4 (Kamis, 17 September 2026) · Praktik 3 JP (135 Menit)**  
**Instrumen Penilaian Nilai Tugas (NT) · Bobot Modul: 14,3% (Maksimal 10 Poin)**

---

**Identitas Peserta:**
- **Nama Peserta:** Achmad Zaenuri (Contoh Hasil Praktik Lab 5a)
- **NIP / Kode Peserta:** PJJ-SIMPEL-01
- **Virtual Host / Alamat Broker:** `amqp://simpel:simpel123@127.0.0.1:5672` (vhost `/`)
- **Tanggal Praktik:** 17 September 2026

---

### Rubrik Penilaian (Total: 10 Poin)

| Komponen Bukti | Bagian Praktik | Poin | Deskripsi Kriteria Kelulusan |
|---|---|:---:|---|
| **1. Alur End-to-End & Idempotensi Gateway** | Lab 5a | 3 | Bukti alur lengkap 5 service berjalan, polling status mencapai `SELESAI`, bukti konsistensi data di 4 tabel (`alur_pengajuan`, `alur_outbox`, `alur_inbox`, `alur_tracking`), serta penolakan HTTP 409 saat reuse key dengan payload berbeda. *(Terisi Lengkap pada Berkas Ini)* |
| **2. Downtime Billing & Saga Kompensasi** | Lab 5b | 3 | Bukti ketahanan saat service Billing down (HTTP 202 tetap terbit, backlog menampung di broker), pemulihan otomatis saat Billing start, dan eksekusi kompensasi Saga saat fault injection `uji-gagal` (reservasi dibatalkan). |
| **3. Komparasi Uji Beban Burst 500 (Dua Jam Ukur)** | Lab 5c | 4 | Tabel perbandingan metrik 500 request (Sync vs Async: p95 response time, p95 completion time, utilisasi DB pool) terisi lengkap disertai analisis arsitektural keunggulan asinkron. |
| **Total Nilai Tugas Lab 5** | | **10** | **Konversi Bobot: 14,3% NT** |

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
*(Bagian ini dikerjakan pada sesi Praktik Lab 5b)*

### 2.1 Ketahanan Sistem saat Service Billing Mati
1. Respons Gateway ke Klien: Gateway tetap membalas `HTTP 202 Accepted` meskipun service Billing mati.
2. Posisi Antrean di RabbitMQ Management UI: Pesan tertampung aman di antrean `alur.billing.q`.

### 2.2 Pemulihan Service Billing (Automatic Drain)
1. Perilaku Sistem: Saat service Billing dinyalakan kembali, seluruh antrean terkuras otomatis tanpa intervensi manual klien.
2. Status Akhir: Status permohonan berlanjut hingga `SELESAI`.

### 2.3 Simulasi Kegagalan Bisnis & Kompensasi Saga (Fault Injection)
1. Alur Karantina: Event gagal masuk ke `alur.billing.dlq`, Billing mem-publish event `billing.gagal`.
2. Tindakan Kompensasi: Service Validasi mengubah reservasi menjadi `'cancelled'` dan mem-publish `pengajuan.dibatalkan`.

---

## BAGIAN 3: Lab 5c — Komparasi Uji Beban Burst 500 (4 Poin)
*(Bagian ini dikerjakan pada sesi Praktik Lab 5c menggunakan script pembanding tools/beban-alur.js)*

| Parameter & Metrik Pengukuran | Mode Synchronous (HTTP Serial) | Mode Asynchronous (RabbitMQ + Outbox) |
|---|:---:|:---:|
| **Total Request Dikirim** | 500 | 500 |
| **Request Berhasil Selesai** | *(Sesi 5c)* | *(Sesi 5c)* |
| **Error / Timeout (HTTP 500 / 504)** | *(Sesi 5c)* | *(Sesi 5c)* |
| **HTTP Response Time (p95)** | *(Sesi 5c)* | *(Sesi 5c)* |
| **Workflow Completion Time (p95)** | *(Sesi 5c)* | *(Sesi 5c)* |
| **Puncak Koneksi DB Sleep (`peakPgSleep`)** | *(Sesi 5c)* | *(Sesi 5c)* |

---

## BAGIAN 4: Verifikasi Otomatis (`verify:day4`)
*(Dijalankan untuk verifikasi menyeluruh di akhir sesi Day 4)*

Perintah eksekusi:
```bash
npm run verify:day4
```
- Status Verifikasi Otomatis: **PASS (12/12 Skenario Lulus)**
