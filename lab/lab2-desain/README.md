# Lab 2 — Perancangan Solusi Integrasi SIMPEL

**Modul MP-05 · Hari 2 · Alokasi Waktu: 45 Menit · Kerja Kelompok (3–4 Orang).**

Lab ini berfokus pada **perancangan arsitektur integrasi di atas kertas**, tanpa instalasi Docker atau coding aplikasi. Gunakan [lembar kerja satu halaman (PDF)](lembar-kerja.pdf) untuk dicetak, atau salin [lembar kerja format Markdown](lembar-kerja.md) ke catatan kerja kelompok Anda.

Cetak biru integrasi yang Anda susun hari ini akan menjadi pegangan langsung saat mengimplementasikan kode producer dan consumer di modul MP-06 sampai MP-08, serta tugas proyek Capstone.

---

## Studi Kasus dan Batasan Sistem

Sistem perizinan fiktif **SIMPEL** memiliki 5 peran service:
- **Gateway**: Menerima request pengajuan izin pemohon via HTTP.
- **Validasi**: Memeriksa kelayakan dan kelengkapan berkas dokumen.
- **Billing**: Menerbitkan kode pembayaran ke sistem perbankan.
- **Notifikasi**: Mengirimkan konfirmasi email/SMS ke pemohon.
- **Tracking**: Mencatat audit log perjalanan berkas dan menyajikan status ke pemohon.

Pada versi synchronous (MP-02), downtime billing dan latensi vendor notifikasi membuat request pemohon menggantung atau gagal total. Tugas kelompok Anda adalah **merancang alur asynchronous berbasis message broker** yang decoupled, tahan gangguan, dan tetap dapat dilacak setiap saat.

### Janji Layanan: Acceptance vs Completion

Tentukan batasan tegas antara kapan request dinyatakan **diterima** (*acceptance*) dan kapan proses dinyatakan **selesai** (*completion*):
- Status **HTTP 202 Accepted** bukan bukti proses bisnis telah selesai! HTTP 202 adalah janji pertanggungjawaban sistem bahwa data pengajuan telah terkunci di storage persisten (database lokal atau queue broker) dan siap diproses lebih lanjut.
- Respons HTTP 202 wajib menyertakan identitas unik `pengajuanId` dan URL pelacakan status (misalnya `/pengajuan/SIM-001/status`).

### Daftar Nama Domain Event Bersama

Gunakan nama domain event standar berikut:

| Service Producer | Nama Event | Arti Bisnis |
|---|---|---|
| `gateway` | `pengajuan.diterima` | Pengajuan tersimpan durable di DB gateway dan siap diproses |
| `validasi` | `pengajuan.valid` | Verifikasi berkas lolos persyaratan bisnis |
| `validasi` | `pengajuan.ditolak` | Verifikasi berkas tidak memenuhi syarat (penolakan bisnis) |
| `billing` | `billing.terbit` | Kode bayar berhasil diterbitkan dan tersimpan di DB billing |

> Penamaan resource queue dan exchange tidak wajib memakai prefix `lab1.`. Kelompok bebas memilih nama exchange dan antrean yang relevan (misalnya Topic Exchange `simpel.events`).

---

## Alokasi Waktu Praktik (45 Menit)

| Waktu | Tahapan Kerja | Target Output yang Harus Terlihat |
|---|---|---|
| **0–5 m** | Bagi peran kelompok & rumuskan janji layanan | Fasilitator, Pencatat, Penantang, Penyaji; kriteria *accepted* vs *completed* |
| **5–15 m** | Gambar diagram alur sukses (*happy path*) | Kotak service, exchange, queue, consumer, titik balasan HTTP 202, dan alur penolakan |
| **15–25 m** | Lengkapi tabel routing & satu kontrak event | Tabel relasi Event $\rightarrow$ Exchange $\rightarrow$ Routing Key $\rightarrow$ Queue $\rightarrow$ Consumer; JSON envelope |
| **25–35 m** | Uji ketahanan desain dengan 3 kartu gangguan | Tempat pesan menunggu, jadwal backoff retry, mekanisme idempotensi, pemilik DLQ |
| **35–42 m** | Peer review silang antar-kelompok | Bertukar lembar kerja, temukan minimal 1 celah konkret, revisi 1 keputusan arsitektur |
| **42–45 m** | Finalisasi & pengumpulan cetak biru | 1 lembar kerja, 1 keputusan utama + alasan, dan 1 risiko terbuka (*open risk*) |

---

## Standar Kontrak Event Minimum (Envelope JSON)

Tuliskan satu kontrak event lengkap (disarankan `pengajuan.valid` atau `billing.terbit`) dengan format envelope standar:

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

**Ketentuan Kontrak:**
- Cantumkan `event`, `schemaVersion`, `messageId`, `correlationId`, `occurredAt` (format UTC ISO-8601), dan objek `data`.
- Pisahkan antara metadata aplikasi dan properti protokol: `messageId` dapat dipetakan ke AMQP property `message_id`, dan `correlationId` ke `correlation_id`.
- Jangan pernah memasukkan binary file dokumen, password, atau credential sensitif ke dalam payload event broker! Gunakan *claim check pattern* (hanya kirim referensi ID atau URL aman).

---

## Tiga Kartu Gangguan (Break Testing)

Uji desain arsitektur kelompok Anda terhadap tiga skenario insiden:

1. **Kartu 1: Service Billing mengalami downtime selama 10 menit.**
   - Di mana pesan pengajuan menunggu? (Queue billing atau outbox?).
   - Bagaimana jadwal backoff retry bertingkatnya? (Contoh: jeda 30 detik, 120 detik, 600 detik).
   - Apa yang dilihat pemohon saat membuka halaman status?
   - Siapa yang bertanggung jawab jika batas retry habis dan pesan masuk ke DLQ?
2. **Kartu 2: Service Notifikasi lambat (latensi pihak ketiga ~3 detik per pesan).**
   - Mengapa kelambatan notifikasi tidak menahan laju pemrosesan billing atau validasi? (Pemisahan queue independen).
   - Apakah status pengajuan di pemohon ikut tertahan?
3. **Kartu 3: Redelivery event duplikat (worker crash setelah commit DB tapi sebelum kirim ack).**
   - Apa kunci idempotensi yang digunakan? (Tabel deduplikasi `(consumer_name, message_id)`).
   - Bagaimana skema database bisnis mencegah terbitnya dua kode pembayaran? (Unique constraint pada `pengajuan_id`).
   - Mengapa pengecekan flag `redelivered` dari broker saja tidak cukup?

---

## Panduan Peer Review dan Evaluasi

Gunakan rubrik skor sederhana (0 = belum ada, 1 = ada tetapi belum konsisten, 2 = solid dan dapat diuji; Total Maksimum: 10):

| Aspek Penilaian | Pertanyaan Penguji |
|---|---|
| **1. Acceptance & Status** | Apakah batas penerimaan durable dipisahkan dari akhir proses bisnis? |
| **2. Topologi Routing** | Apakah setiap event sampai ke consumer yang tepat tanpa dua service berebut satu queue? |
| **3. Kontrak Event** | Apakah skema envelope, identitas unik, versi, dan data minimum terdefinisi jelas? |
| **4. Penanganan Kegagalan** | Apakah retry berbatas, strategi idempotensi, dan kepemilikan DLQ menjawab 3 kartu gangguan? |
| **5. Pembuktian & Pengujian** | Apakah terdapat rencana pengujian konkret untuk memvalidasi alur sukses dan alur recovery? |

Simpan hasil kerja kelompok dengan nama `lab2-<nama-kelompok>.pdf` atau `.md`. Cetak biru ini akan digunakan kembali saat praktik implementasi producer-consumer di MP-06 sampai MP-08.
