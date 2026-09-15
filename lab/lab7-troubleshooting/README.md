# Lab 7 — Investigasi Empat Kasus Troubleshooting

**Modul MP-10 · Hari 5 (Jumat, 18 September 2026) · Praktik 1 JP (45 Menit per Kelompok).**

Lab ini adalah simulasi pemecahan insiden nyata (*incident response drill*). Setiap kelompok diberikan **satu kasus gangguan terdistribusi** untuk diinvestigasi secara sistematis dalam waktu 45 menit, sebelum saling mempresentasikan temuan dan solusinya ke kelompok lain.

Seluruh latihan menggunakan stack Docker terisolasi `simpel-ops` dari Lab 6.

---

## Persiapan Environment

Jalankan stack operasional dari root direktori `simpel-lab/`:

```bash
npm run operasi -- up
```

### Pemetaan Empat Kasus Gangguan

Setiap kasus beroperasi pada vhost terpisah (`lab7-a` s.d. `lab7-d`) dengan 5 event sintetis ber-ID tetap:

| Kasus | Perintah Inisialisasi | Titik Pengamatan Utama | Karakteristik Masalah |
|---|---|---|---|
| **Kasus A** | `npm run kasus -- prepare a` | Kolom Ready naik, Consumer = 0 | Worker consumer offline / tidak aktif |
| **Kasus B** | `npm run kasus -- prepare b` → `worker b` | Antrean `unmatched` bertambah | Kesalahan binding key pada exchange |
| **Kasus C** | `npm run kasus -- prepare c` → `worker c` | Pesan menggantung di kolom Unacked | Worker macet menanti dependensi eksternal |
| **Kasus D** | `npm run kasus -- prepare d` → `worker d` | Siklus retry habis, pesan masuk DLQ | Kegagalan dependensi berulang & poison pill |

Contoh eksekusi untuk kelompok yang menangani **Kasus C**:

```bash
# Terminal 1: Inisialisasi data uji
npm run kasus -- prepare c

# Terminal 2: Nyalakan worker kasus C
npm run kasus -- worker c

# Terminal 1: Periksa kondisi antrean
npm run kasus -- inspect c
```

Buka RabbitMQ Management di `http://127.0.0.1:15695` atau Grafana di `http://127.0.0.1:3005/d/simpel-ops` dan pilih vhost kelompok Anda (`lab7-c`). Login dengan kredensial: `labops` / `labops-only`.

---

## Alur Investigasi 45 Menit

1. **Menit 0–5 (Pembagian Peran):** Tentukan peran Operator (eksekutor CLI), Pencatat (mendokumentasikan log/metrik), dan Penantang Hipotesis (*Devil's Advocate* yang menguji asumsi).
2. **Menit 5–15 (Observasi Kondisi Awal):** Catat metrik tanpa mengubah backlog (periksa nilai Ready, Unacked, jumlah Consumer, dan error log di terminal worker).
3. **Menit 15–25 (Perumusan Dua Hipotesis):** Rumuskan minimal 2 hipotesis akar masalah dan tentukan pemeriksaan teknis yang dapat membuktikan salah satu hipotesis tersebut.
4. **Menit 25–35 (Penerapan Solusi & Verifikasi):** Jalankan tindakan perbaikan dan verifikasi bahwa seluruh data berhasil diproses tanpa ada duplikasi.
5. **Menit 35–45 (Presentasi Singkat):** Siapkan kesimpulan singkat untuk dipresentasikan ke kelompok lain.

---

## Prosedur Perbaikan (*Repair*) dan Verifikasi

Setelah menemukan akar masalah dan mencatat buktinya, terapkan script perbaikan yang sesuai:

```bash
# Untuk Kasus B, C, atau D:
npm run kasus -- repair c
npm run kasus -- inspect c
npm run kasus -- verify c
```

*(Untuk Kasus A, perbaikan cukup dengan menjalankan worker di terminal kedua: `npm run kasus -- worker a`).*

### Kriteria Kelulusan Verifikasi

Perintah `verify` dinyatakan **LULUS** apabila:
1. Kelima ID input asli berhasil diproses dan tercatat lengkap di tabel `lab7_hasil`.
2. Tidak ada duplikasi receipt berkat proteksi unique constraint `(case_id, message_id)`.
3. Seluruh antrean kasus kembali bersih (Ready: 0 dan Unacked: 0).

> **Peringatan Penting:** Dilarang melakukan *purge queue*, menghapus database, atau meregenerasi ID pesan untuk memanipulasi hasil verifikasi! Investigasi yang jujur berfokus pada memahami mengapa pesan tertahan dan bagaimana mengalirkannya kembali secara aman.

---

## Deliverable yang Dikumpulkan (Laporan Praktik)

Praktik Lab 7 memiliki bobot penilaian **5,7% Nilai Total Pelatihan (NT)** sesuai instrumen penilaian MP-10 (Sesi 14 / Troubleshooting Kasus Lapangan, total 10 poin):
1. **Identifikasi Status Antrean & Observasi Metrik (Bobot: 20% / 2 Poin):** Pencatatan metrik vhost kasus (Ready, Unacked, Consumers) dan cuplikan log error/peringatan yang relevan.
2. **Formulasi Dua Hipotesis Kerja (Bobot: 25% / 2.5 Poin):** Hipotesis primer dan hipotesis alternatif yang masuk akal secara teknis sebelum perbaikan dilakukan.
3. **Uji Pembuktian Hipotesis & Logika Akar Masalah (Bobot: 25% / 2.5 Poin):** Langkah investigasi untuk membuktikan/menolak hipotesis dengan rujukan mekanisme AMQP.
4. **Tindakan Perbaikan & Bukti Verifikasi (Bobot: 20% / 2 Poin):** Output lolos `npm run kasus -- verify <id>` (5/5 ID terproses, 0 duplikat, antrean bersih).
5. **Rekomendasi Mitigasi Jangka Panjang (Bobot: 10% / 1 Poin):** Usulan pencegahan di level arsitektur / konfigurasi production agar insiden serupa tidak terulang.

Peserta dapat mengisi dan mengumpulkan laporan menggunakan salah satu format berikut:
- **Format Word (.docx):** Gunakan template resmi [**`lembar-laporan.docx`**](lembar-laporan.docx) *(disarankan)*.
- **Format Markdown (.md):** Salin dan isi template [**`lembar-laporan.md`**](lembar-laporan.md).
- **Format PDF (.pdf):** Ekspor dari berkas `.docx` atau `.md` yang telah diisi lengkap.

Beri nama berkas sesuai format: `lab7-<nama-atau-nip-peserta>.<docx|md|pdf>` dan kumpulkan ke LMS / Google Drive kelas PJJ sesuai arahan fasilitator.

---

## Menghentikan Stack Setelah Selesai

Hentikan seluruh worker dengan menekan `Ctrl+C`, lalu bersihkan compose stack:

```bash
npm run operasi -- down
```

Rujukan teknis: [RabbitMQ Alarms](https://www.rabbitmq.com/docs/alarms) dan [Production Troubleshooting Guide](https://www.rabbitmq.com/docs/troubleshooting).
