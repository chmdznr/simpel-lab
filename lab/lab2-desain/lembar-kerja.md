# Lab 2 — Lembar Desain Integrasi SIMPEL (1 Halaman)

**Nama Kelompok:** ____________________  
**Anggota Tim:** ____________________ (Fasilitator / Pencatat / Penantang / Penyaji)  
**Tanggal Pelaksanaan:** ____________________  

---

### 1. Kebutuhan Bisnis & Janji Layanan
- **Kapan pengajuan dinyatakan DITERIMA (*accepted*)?** (Data apa yang tersimpan secara durable dan apa bukti yang diterima pemohon?):  
  ____________________________________________________________________________________________________
- **Kapan seluruh proses dinyatakan SELESAI (*completed*)?** (Siapa service pemilik hasil akhir bisnis?):  
  ____________________________________________________________________________________________________
- **Batas toleransi penundaan (*tolerable delay*) & persistensi data:**  
  ____________________________________________________________________________________________________

---

### 2. Diagram Alur Data & Kepemilikan State
*(Gambarkan relasi: Pemohon → Gateway → Exchange → Queue → Consumer. Tandai titik balasan HTTP 202, cabang penolakan bisnis, dan service pemilik database di setiap tahap).*

```text
[ Diagram Alur Sistem: Lampirkan gambar tangan atau sketsa diagram di lembar terpisah ]
```

---

### 3. Tabel Topologi Routing (Topic Exchange `simpel.events`)
*(Tuliskan satu baris untuk setiap subscription antrean yang dibutuhkan)*

| Nama Event Bisnis | Exchange & Tipe | Routing / Binding Key | Queue Tujuan → Consumer |
|---|---|---|---|
| `pengajuan.diterima` | `simpel.events` (topic) | `pengajuan.diterima` | `validasi.q` → Service Validasi |
| `pengajuan.valid` | `simpel.events` (topic) | `pengajuan.valid` | `billing.q` → Service Billing |
| `billing.terbit` | `simpel.events` (topic) | `billing.terbit` | `notifikasi.q` → Service Notifikasi |
| `pengajuan.#` | `simpel.events` (topic) | `pengajuan.#` | `tracking.q` → Service Tracking |
| `billing.#` | `simpel.events` (topic) | `billing.#` | `tracking.q` → Service Tracking |
| | | | |

---

### 4. Spesifikasi Kontrak Event Minimum (Envelope JSON)
*(Contoh kontrak event: `pengajuan.valid` atau `billing.terbit`)*

```json
{
  "event": "pengajuan.valid",
  "schemaVersion": 1,
  "messageId": "evt-002",
  "correlationId": "corr-001",
  "occurredAt": "2026-09-15T03:00:00Z",
  "data": {
    "pengajuanId": "SIM-001"
  }
}
```
- **Aturan ID & Retry:** `messageId` dipertahankan saat retry; `correlationId` mengikat alur penelusuran end-to-end.
- **Kebijakan Skema Invalid:** ____________________________________________________________________

---

### 5. Pengujian Ketahanan Sistem (3 Kartu Gangguan)

| Skenario Insiden | Tindakan Sistem, Tempat Menunggu, & Mekanisme Idempotensi |
|---|---|
| **Billing down 10 menit** | Antrean menunggu di: ____________________  Jadwal backoff retry: ____________________  Tampilan status pemohon: ____________________ |
| **Notifikasi lambat 3 detik** | Pemisahan antrean: ____________________  Apakah status billing tertahan?: ____________________ |
| **Event duplikat (crash post-commit pre-ack)** | Kunci dedup teknis `(consumer, message_id)`: ____________________  Unique constraint database bisnis: ____________________ |

- **Batas Percobaan Retry & Backoff:** 1 percobaan awal + 3 retry bertingkat (30s, 120s, 600s).
- **Kepemilikan DLQ & Prosedur Redrive:** Exchange `simpel.dlx` → Queue `billing.dlq`. Pemilik: Tim Ops Billing; syarat redrive: bug diperbaiki & redrive bertahap via batch kecil.

---

### 6. Keputusan Arsitektur, Peer Review, & Risiko Terbuka
- **Keputusan Utama & Alasan Pemilihan Broker:** ____________________________________________________________________
- **Satu Celah Arsitektur yang Ditemukan Kelompok Peninjau:** _______________________________________________________
- **Revisi Desain & Hipotesis Pengujian Kode:** _____________________________________________________________________
- **Satu Risiko Terbuka (*Open Risk*) yang Belum Terselesaikan:** ____________________________________________________

**Checklist Evaluasi Mandiri:**  
`[ ]` Kebutuhan & Janji Layanan &nbsp;&nbsp;&nbsp; `[ ]` Topologi Routing &nbsp;&nbsp;&nbsp; `[ ]` Kontrak Event &nbsp;&nbsp;&nbsp; `[ ]` Mitigasi Gangguan &nbsp;&nbsp;&nbsp; `[ ]` Bukti Pengujian
