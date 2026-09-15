# Template Proyek Action Learning — [Judul Studi Kasus]

**Panduan Pengerjaan Minggu Kedua (21–25 September 2026).**  
Alokasi: 7 JP pengerjaan mandiri + 3 JP sesi sinkron (presentasi & evaluasi).

---

## 1. Identifikasi Masalah, Ruang Lingkup, & Kriteria Keberhasilan

- **Latar Belakang Masalah:** Jelaskan kendala integrasi atau performa pada sistem yang Anda pilih (misalnya masalah latensi berantai, hilangnya data saat downtime, atau kebutuhan decoupling sistem).
- **Pengguna & Peran Sistem:** Siapa yang mengirim request dan siapa saja service yang terlibat.
- **Batasan Prototipe:** Gunakan data sintetis dan definisikan batas ruang lingkup implementasi.
- **Kriteria Keberhasilan yang Terukur:** Rumuskan indikator kelulusan yang objektif (contoh: *"10 request pengajuan yang dikirim saat consumer offline berhasil dipulihkan tanpa ada data hilang atau terduplikasi setelah worker aktif kembali"*).

---

## 2. Arsitektur Sistem & Spesifikasi Kontrak Event

- **Diagram Topologi:** Lampirkan diagram arsitektur yang memuat relasi Producer → Exchange (beserta tipenya) → Binding Key → Queue → Consumer Worker → Database.
- **Pilihan Pola Integrasi:** Jelaskan alasan pemilihan pola (Work Queue, Publish-Subscribe, atau Selective Routing).
- **Janji Layanan (Acceptance vs Completion):** Kapan respons HTTP dikembalikan ke pengguna (misalnya via HTTP 202) dan kapan proses bisnis dinyatakan selesai tuntas.
- **Spesifikasi Kontrak Event:** Tuliskan contoh schema JSON envelope lengkap (`event`, `schemaVersion`, `messageId`, `correlationId`, `occurredAt`, dan payload data).
- **Strategi Idempotensi:** Jelaskan bagaimana consumer mencegah efek bisnis ganda saat terjadi redelivery.

---

## 3. Petunjuk Menjalankan dan Menghentikan Sistem

Sediakan instruksi CLI yang jelas agar evaluator dapat menjalankan sistem Anda secara mandiri:

```bash
# 1. Prasyarat lingkungan (Node.js version, Docker Compose)
# 2. Menyiapkan konfigurasi environment (.env)
# 3. Menjalankan infrastruktur broker & database
docker compose up -d

# 4. Menjalankan producer dan consumer
# 5. Menjalankan pengujian / generator beban
```

Pastikan tidak ada kredensial sensitif atau password produksi yang disertakan dalam repositori.

---

## 4. Konfigurasi Routing dan Kontrol Akses

- Tuliskan deklarasi exchange, nama queue, durabilitas, serta routing key / binding pattern yang digunakan.
- Sertakan kebijakan hak akses (permission regex) pada vhost jika menerapkan user non-admin.

---

## 5. Bukti Hasil Pengujian (Evidence Matrix)

Lakukan pengujian terencana dan catat hasilnya pada tabel bukti:

| Skenario Pengujian | Input / ID Uji | Hasil yang Diharapkan | Hasil Aktual | Lokasi File Bukti (*Logs/Screenshot*) | Status Kelulusan |
|---|---|---|---|---|---|
| **Alur Normal (*Happy Path*)** | `SIM-001` | Diproses sukses, status SELESAI | Sesuai | `.evidence/normal.json` | `LULUS` |
| **Simulasi Downtime Consumer** | `SIM-002` | Pesan tertahan di queue, pulih saat up | Sesuai | `.evidence/downtime.json` | `LULUS` |
| **Redelivery / Duplikasi** | `SIM-003` | Tidak menghasilkan transaksi ganda | Sesuai | `.evidence/dedup.json` | `LULUS` |
| **Kegagalan & DLQ** | `SIM-004` | Masuk ke DLQ setelah batas retry habis | Sesuai | `.evidence/dlq.json` | `LULUS` |

---

## 6. Laporan Investigasi Troubleshooting

Dokumentasikan satu insiden atau kendala teknis yang sempat terjadi selama pengerjaan proyek, lengkap dengan alur investigasinya:
- **Gejala Masalah:** Pesan error di log atau anomali metrik antrean.
- **Dua Hipotesis Penyebab:** Dugaan awal penyebab masalah.
- **Langkah Pembuktian:** Cara Anda membedakan kedua hipotesis tersebut.
- **Solusi yang Diterapkan:** Perbaikan konfigurasi atau kode program.
- **Hasil Akhir Pasca Perbaikan:** Bukti bahwa sistem telah berfungsi normal kembali.

---

## 7. Batasan Sistem dan Pengembangan Berikutnya

Jelaskan secara jujur hal-hal yang belum tercakup dalam prototipe ini (misalnya: masih menggunakan broker standalone single-node, belum menerapkan enkripsi TLS mTLS, atau retensi log audit yang masih sementara).

---

## 8. Kontribusi dan Rujukan

Sebutkan komponen dari materi SIMPEL yang Anda gunakan ulang serta bagian inovasi mandiri yang Anda kembangkan bersama tim.

---

## Jadwal Checkpoint & Presentasi

| Hari / Tanggal | Alokasi Waktu | Target Hasil Kerja (*Milestone*) |
|---|---|---|
| **Senin, 21 September** | 2 JP Mandiri | Finalisasi rumusan masalah, diagram topologi, dan kontrak event |
| **Selasa, 22 September** | 2 JP Mandiri | Implementasi dasar producer, exchange, queue, dan consumer aktif |
| **Rabu, 23 September** | 2 JP Mandiri | Implementasi pola routing lengkap dan pencatatan bukti pengujian |
| **Kamis, 24 September** | 1 JP Mandiri | Pengujian skenario failure/recovery dan penyusunan laporan |
| **Jumat, 25 September** | 3 JP Sinkron | Presentasi hasil proyek di depan kelas dan sesi feedback (135 menit) |
