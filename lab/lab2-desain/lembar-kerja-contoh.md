# Lab 2 — Contoh Lembar Desain Integrasi SIMPEL (Cetak Biru Terisi)

**Nama Kelompok:** Kelompok 1 — Tim Arsitektur Integrasi SIMPEL  
**Anggota Tim:** Budi (Fasilitator), Siti (Pencatat), Ahmad (Penantang), Rian (Penyaji)  
**Tanggal Pelaksanaan:** 15 September 2026 (PJJ Message Broker TA 2026)  
**Tautan Implementasi:** Selaras dengan kode `simpel-lab/layanan/alur.js` & `messaging.js` (MP-06 s.d. MP-08)

---

### 1. Kebutuhan Bisnis & Janji Layanan
* **Kapan pengajuan dinyatakan DITERIMA (*accepted*)?**  
  Pengajuan dinyatakan diterima saat format request HTTP tervalidasi dasar, data pengajuan tersimpan secara durable di tabel database lokal Gateway (`pengajuan`, status `'diterima'`), dan event `pengajuan.diterima` dicatat di tabel Outbox dalam satu transaksi database lokal yang sama (Transactional Outbox).  
  *Bukti untuk Pemohon:* Respons **HTTP 202 Accepted** dengan payload `{"status":"diterima","pengajuanId":"SIM-001","trackingUrl":"/pengajuan/SIM-001/status"}`.
* **Kapan seluruh proses dinyatakan SELESAI (*completed*)?**  
  Proses dinyatakan selesai saat Service Billing berhasil menerbitkan kode pembayaran perizinan (`BIL-SIM-001`), menyimpannya di tabel database `alur_billing`, dan mem-publish event `billing.terbit`. Service Billing adalah pemilik (*owner*) status akhir penyelesaian transaksi tahap perizinan ini.
* **Batas toleransi penundaan (*tolerable delay*) & persistensi data:**  
  Toleransi latensi verifikasi berkas $\le 5$ detik; penerbitan billing $\le 15$ detik (saat lonjakan beban $\le 2$ menit). Seluruh antrean dideklarasikan `durable: true` dan pesan dikirim dengan flag `persistent: true` (delivery_mode = 2) untuk menjamin nol kehilangan data saat broker restart.

---

### 2. Diagram Alur Data & Kepemilikan State

```text
[ Pemohon ]
    │ (1) HTTP POST /pengajuan
    ▼
┌─────────────────────────────────────────────────────────────┐
│ SERVICE GATEWAY (Pemilik DB Gateway: tabel pengajuan)       │
│ • Transaksi lokal: Simpan pengajuan + Catat outbox          │
│ • Kirim respons HTTP 202 Accepted (pengajuanId: SIM-001)    │
└──────────────────────────────┬──────────────────────────────┘
                               │ (2) Publish event: pengajuan.diterima
                               ▼
            ╔════════════════════════════════════╗
            ║ Topic Exchange: simpel.events     ║
            ╚════════════════════════════════════╝
                 │                           │
                 │ (rk: pengajuan.diterima)  │ (rk: #)
                 ▼                           ▼
┌──────────────────────────────┐    ┌─────────────────────────────────┐
│ validasi.q                   │    │ tracking.q                      │
└──────────────┬───────────────┘    └────────────────┬────────────────┘
               ▼                                     ▼
┌──────────────────────────────┐    ┌─────────────────────────────────┐
│ SERVICE VALIDASI             │    │ SERVICE TRACKING                │
│ • DB: alur_validasi          │    │ • DB: alur_tracking             │
│   (status: 'reserved')       │    │ • Catat timeline audit trail    │
│ • Sukses: publish event      │    │   semua event secara transparan │
│   validasi.selesai           │    └─────────────────────────────────┘
└──────────────┬───────────────┘
               │ (3) rk: validasi.selesai
               ▼
            ╔════════════════════════════════════╗
            ║ Topic Exchange: simpel.events     ║
            ╚════════════════════════════════════╝
                 │                           │
                 │ (rk: validasi.selesai)    │ (rk: #)
                 ▼                           ▼
┌──────────────────────────────┐    ┌─────────────────────────────────┐
│ billing.q                    │    │ tracking.q (update status)      │
└──────────────┬───────────────┘    └─────────────────────────────────┘
               ▼
┌──────────────────────────────┐
│ SERVICE BILLING              │
│ • DB: alur_billing           │
│   (kode: BIL-SIM-001)        │
│ • Sukses: publish event      │
│   billing.terbit             │
└──────────────┬───────────────┘
               │ (4) rk: billing.terbit
               ▼
            ╔════════════════════════════════════╗
            ║ Topic Exchange: simpel.events     ║
            ╚════════════════════════════════════╝
                 │                           │
                 │ (rk: billing.terbit)      │ (rk: #)
                 ▼                           ▼
┌──────────────────────────────┐    ┌─────────────────────────────────┐
│ notifikasi.q                 │    │ tracking.q (update status)      │
└──────────────┬───────────────┘    └─────────────────────────────────┘
               ▼
┌──────────────────────────────┐
│ SERVICE NOTIFIKASI           │
│ • Kirim konfirmasi email/SMS │
│ • DB: alur_notifikasi        │
└──────────────────────────────┘

ALUR KEGAGALAN & KOMPENSASI (SAGA PATTERN):
• Jika validasi gagal bisnis: Validasi mem-publish event pengajuan.ditolak (hanya masuk ke tracking.q, tidak ke billing.q).
• Jika billing gagal sistemik/timeout: Billing mem-publish event billing.gagal -> diterima validasi.q -> Service Validasi melakukan kompensasi dengan mengubah status di alur_validasi dari 'reserved' menjadi 'cancelled' -> publish pengajuan.dibatalkan.
```

---

### 3. Tabel Topologi Routing (Topic Exchange `simpel.events`)

| Nama Event Bisnis | Exchange & Tipe | Routing / Binding Key | Queue Tujuan $\rightarrow$ Consumer | Peran Pemrosesan |
|---|---|---|---|---|
| `pengajuan.diterima` | `simpel.events` (topic) | `pengajuan.diterima` | `validasi.q` $\rightarrow$ Service Validasi | Validasi kelayakan dokumen dan perizinan |
| `validasi.selesai` | `simpel.events` (topic) | `validasi.selesai` | `billing.q` $\rightarrow$ Service Billing | Penerbitan kode pembayaran billing |
| `billing.terbit` | `simpel.events` (topic) | `billing.terbit` | `notifikasi.q` $\rightarrow$ Service Notifikasi | Pengiriman notifikasi email/SMS ke pemohon |
| `pengajuan.#` | `simpel.events` (topic) | `pengajuan.#` | `tracking.q` $\rightarrow$ Service Tracking | Audit trail log siklus hidup pengajuan |
| `billing.#` | `simpel.events` (topic) | `billing.#` | `tracking.q` $\rightarrow$ Service Tracking | Audit trail penerbitan & kegagalan billing |
| `billing.gagal` | `simpel.events` (topic) | `billing.gagal` | `validasi.q` $\rightarrow$ Service Validasi | Kompensasi Saga: pembatalan reservasi izin |
| `*` (pesan rusak) | `simpel.invalid` (direct) | `invalid` | `pengajuan.invalid` (DLQ) | Karantina pesan cacat skema untuk investigasi |

---

### 4. Spesifikasi Kontrak Event Minimum (Envelope JSON)

Berikut adalah contoh kontrak event `pengajuan.valid` / `validasi.selesai` yang digunakan pada `messaging.js`:

```json
{
  "event": "validasi.selesai",
  "schemaVersion": 1,
  "messageId": "evt-7f8a9b0c-1234-4567-89ab-cdef01234567",
  "correlationId": "corr-SIM-001-20260915",
  "occurredAt": "2026-09-15T08:30:00.000Z",
  "data": {
    "pengajuanId": "SIM-001",
    "pemohon": "PT Maju Bersama",
    "jenis": "SIUP",
    "kantor": "KPP-Jakarta",
    "hasilValidasi": "lengkap",
    "petugas": "petugas-04"
  }
}
```

* **Aturan ID & Pelacakan:**
  * `messageId`: Wajib unik untuk setiap publikasi pesan baru (digunakan sebagai kunci idempotensi di consumer). Saat terjadi *retry*, `messageId` tidak boleh berubah agar worker mengenali duplikasi.
  * `correlationId`: Mengikat seluruh alur pesan dari Gateway sampai Notifikasi, dipetakan ke header AMQP `correlation_id` untuk observabilitas end-to-end.
* **Kebijakan Skema Invalid:**
  * Jika consumer menerima pesan dengan `schemaVersion` tidak didukung atau field wajib kosong: consumer menolak dengan `channel.reject(msg, false)`. Antrean dilengkapi konfigurasi `x-dead-letter-exchange: "simpel.invalid"` dan `x-dead-letter-routing-key: "invalid"`, sehingga pesan cacat langsung diisolasi ke antrean `pengajuan.invalid` tanpa menyumbat worker.

---

### 5. Pengujian Skenario Gangguan (Break Testing)

| Skenario Gangguan | Dampak Desain & Penanganan Teknis | Perilaku terhadap Pemohon / Status | Pemilik Pemulihan & Bukti |
|---|---|---|---|
| **1. Service Billing Down 10 Menit** | Pesan `validasi.selesai` tetap tersimpan aman di `billing.q` yang durable. Tidak ada pesan yang drop. Saat billing hidup kembali, worker memproses tumpukan pesan secara berurutan sesuai kapasitas prefetch. | Pemohon membuka URL tracking `/pengajuan/SIM-001/status` dan melihat status `"Menunggu Penerbitan Kode Billing"`. Tidak ada HTTP 504 Gateway Timeout. | **Pemilik:** Admin Billing & SRE.<br/>**Bukti:** Grafik antrean `billing.q` di Prometheus naik selama 10 menit, lalu surut ke nol setelah worker hidup kembali tanpa ada data hilang. |
| **2. Notifikasi Lambat (3 detik/pesan)** | `notifikasi.q` terisolasi secara independen dari alur utama. Lonjakan antrean di `notifikasi.q` tidak membebani `billing.q` maupun `validasi.q`. | Status izin dan kode billing pemohon sudah terbit secara sah di sistem. Hanya pengiriman email pengingat yang mengalami sedikit penundaan (*eventual delivery*). | **Pemilik:** Tim Notifikasi.<br/>**Bukti:** Billing selesai dalam $\le 1$ detik; log pengiriman email bertahap memproses antrean notifikasi tanpa error. |
| **3. Worker Crash Sebelum Kirim Ack (Duplikat)** | Broker melakukan *redelivery* pesan yang sama ke worker lain (`redelivered: true`). Worker menggunakan tabel deduplikasi `alur_inbox (owner, message_id)`. Transaksi database kedua dibatalkan via advisory lock / unique constraint `pengajuan_id`. Worker langsung mengirimkan `channel.ack()`. | Pemohon tetap menerima satu kode billing unik (`BIL-SIM-001`). Tidak pernah ada penagihan ganda (*double billing*). | **Pemilik:** Worker Consumer.<br/>**Bukti:** Log terminal menampilkan `{"duplicate":"evt-..."}`, tabel `alur_billing` hanya berisi tepat 1 baris untuk `SIM-001`. |

* **Kebijakan Retry & DLQ:**
  * Retry kegagalan sementara (*transient failure*) menggunakan pola Transactional Outbox dengan interval `available_at` bertingkat (contoh: 30 detik, 120 detik, 600 detik).
  * Batas retry maksimal 3 kali. Jika tetap gagal setelah 3 kali percobaan, pesan dialihkan ke `alur.billing.dlq` dengan header `x-death` lengkap untuk diinvestigasi oleh operator teknis.

---

### 6. Keputusan Arsitektur & Tinjauan Sejawat (Peer Review)

* **Pola Arsitektur yang Dipilih & Alasan:**  
  Menggunakan **Choreography Event-Driven Architecture** dengan **Topic Exchange (`simpel.events`)** dan pola **Transactional Outbox/Inbox**. Alasan: Menghilangkan kopling sinkron langsung antar-service, mengisolasi titik kegagalan (*fault isolation*), dan menjamin data tidak hilang saat node aplikasi crash sebelum pesan sampai ke broker.
* **Celah yang Ditemukan saat Peer Review:**  
  *Temuan Kelompok Peninjau:* Jika pesan validasi ditolak (`pengajuan.ditolak`), belum ada mekanisme untuk memberi tahu pemohon secara langsung selain mengecek halaman status.  
  *Tindakan Revisi:* Menambahkan routing key `pengajuan.ditolak` ke `notifikasi.q` agar pemohon juga menerima email pemberitahuan penolakan berkas beserta alasan revisinya.
* **Risiko Terbuka (*Open Risk*):**  
  Service Tracking mendengarkan seluruh event (`#`). Pada kondisi *traffic spike* ekstrem (misalnya ribuan pengajuan per detik), antrean `tracking.q` berpotensi mengalami penumpukan paling cepat dibanding antrean lain.  
  *Rencana Mitigasi:* Di Lab 3/4 akan dikonfigurasi `prefetch: 50` dan penskalaan worker tracking secara horizontal (*multiple worker consumers*).
