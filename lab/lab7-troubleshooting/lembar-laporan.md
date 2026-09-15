# Lab 7 — Lembar Laporan Investigasi Kasus Troubleshooting

**Modul MP-10 · Hari 5 (Jumat, 18 September 2026) · Praktik 2 JP (90 Menit)**  
**Instrumen Penilaian Nilai Tugas (NT) · Bobot Modul: 5,7% (Maksimal 10 Poin)**

---

**Identitas Kelompok & Pembagian Peran:**
- **Kelompok / Meja:** ____________________
- **Kasus yang Ditetapkan:** Kasus `[ A / B / C / D ]` (Vhost: `lab7-[a/b/c/d]`)
- **Operator CLI:** ____________________ (eksekutor perintah & observasi)
- **Pencatat (Scribe):** ____________________ (dokumentasi log, metrik, & bukti)
- **Penantang Hipotesis (*Devil's Advocate*):** ____________________ (menguji asumsi investigasi)
- **Tanggal Praktik:** ____________________

---

### Rubrik Penilaian (Total: 10 Poin)

| Komponen Bukti | Bagian Praktik | Poin | Deskripsi Kriteria Kelulusan |
|---|---|:---:|---|
| **1. Observasi Awal & Formulasi Dua Hipotesis** | Bagian 1 | 3 | Pencatatan objektif metrik awal (Ready, Unacked, Consumer count, cuplikan log) serta perumusan minimal 2 hipotesis akar masalah yang dapat dibuktikan. |
| **2. Uji Pembuktian, Perbaikan, & Verifikasi** | Bagian 2 | 4 | Bukti pengujian yang membedakan hipotesis benar vs salah, penerapan script perbaikan (`repair`), serta kelulusan perintah `verify` (5/5 ID sukses, zero duplicate, antrean surut ke 0). |
| **3. Refleksi Metodologi & Mitigasi Pencegahan** | Bagian 3 | 3 | Penjelasan batas pembuktian terakhir (*last proven boundary*), mengapa dilarang melakukan purge queue saat insiden, dan rancangan mitigasi jangka panjang. |
| **Total Nilai Tugas Lab 7** | | **10** | **Konversi Bobot: 5,7% NT** |

---

## BAGIAN 1: Observasi Kondisi Awal & Perumusan Hipotesis (3 Poin)

### 1.1 Inisialisasi & Pengamatan Metrik Sebelum Perbaikan
*(Jalankan `npm run kasus -- prepare <kasus>` dan `npm run kasus -- inspect <kasus>`)*

1. **Snapshot Metrik Antrean Awal:**
   - Nama Vhost / Antrean: `lab7-______` / `____________________`
   - Messages Ready: `______` pesan.
   - Messages Unacked: `______` pesan.
   - Consumers Aktif: `______` worker.

2. **Cuplikan Pesan Log Error / Gejala Utama di Terminal:**
   ```text
   [ Salin baris log kunci dari terminal worker atau inspect di sini ]
   ```

3. **Karakteristik Masalah yang Teramati:**
   - Gejala utama: `[ Antrean menumpuk tanpa consumer / Pesan lari ke unmatched / Pesan macet unacked / Pesan gagal masuk DLQ ]`

---

### 1.2 Perumusan Dua Hipotesis Akar Masalah

Tuliskan dua dugaan teknis yang berbeda sebelum melakukan tindakan perbaikan apa pun:

- **Hipotesis 1 (Dugaan Utama):**  
  *Penyebab:* __________________________________________________________________________________________________  
  *Cara Membuktikan:* __________________________________________________________________________________________

- **Hipotesis 2 (Dugaan Alternatif):**  
  *Penyebab:* __________________________________________________________________________________________________  
  *Cara Membuktikan:* __________________________________________________________________________________________

---

## BAGIAN 2: Pembuktian, Tindakan Perbaikan, & Verifikasi (4 Poin)

### 2.1 Hasil Uji Pembuktian
- Hipotesis yang terbukti benar: **[ Hipotesis 1 / Hipotesis 2 ]**
- Bukti teknis yang mengonfirmasi: ______________________________________________________________________________  
  ______________________________________________________________________________________________________________

---

### 2.2 Tindakan Perbaikan (*Remediation*)
*(Jalankan langkah perbaikan atau perintah `npm run kasus -- repair <kasus>`)*

Tindakan perbaikan teknis yang dilakukan:  
______________________________________________________________________________________________________________  
______________________________________________________________________________________________________________

---

### 2.3 Hasil Verifikasi Akhir (`npm run kasus -- verify <kasus>`)
*(Jalankan perintah verifikasi resmi)*

```text
[ Salin output lengkap dari perintah npm run kasus -- verify <kasus> di sini ]
```

*Kriteria Kelulusan:*
- [ ] 5 dari 5 ID input asli berhasil diproses tuntas.
- [ ] Tidak ada duplikasi record di tabel database `lab7_hasil` (Zero Duplicate).
- [ ] Seluruh antrean kasus kembali bersih (Ready = 0, Unacked = 0).
- Status Verifikasi: **[ LULUS (PASS) / GAGAL (FAIL) ]**

---

## BAGIAN 3: Refleksi Metodologi Investigasi & Mitigasi (3 Poin)

1. **Prinsip "Temukan Batas Terakhir yang Terbukti" (*Find the Last Proven Boundary*):**  
   Pada kasus kelompok Anda, di lapisan mana pesan berhenti mengalir secara normal (Gateway → Exchange → Queue → Consumer Memory → Database)? Bagaimana cara Anda membuktikannya?  
   *Jawaban:* ____________________________________________________________________________________________________  
   ____________________________________________________________________________________________________

2. **Larangan Operasional:**  
   Mengapa tindakan panik seperti me-restart broker secara mendadak atau melakukan *Purge Queue* sangat dilarang saat menangani insiden di sistem produksi perizinan publik?  
   *Jawaban:* ____________________________________________________________________________________________________  
   ____________________________________________________________________________________________________

3. **Rekomendasi Mitigasi Jangka Panjang:**  
   Mekanisme arsitektural atau konfigurasi apa yang harus dipasang agar jenis gangguan pada kasus Anda tidak pernah berulang kembali di lingkungan produksi? (Contoh: Dead-Letter Exchange, Alternate Exchange, Timeout & Circuit Breaker, Alerting Rule).  
   *Jawaban:* ____________________________________________________________________________________________________  
   ____________________________________________________________________________________________________
