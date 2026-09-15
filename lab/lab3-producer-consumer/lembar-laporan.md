# Lab 3 — Lembar Laporan Praktik Producer, Consumer, & Bukti Pemrosesan

**Modul MP-06 · Hari 3 (Rabu, 16 September 2026) · Praktik 4 JP (180 Menit)**  
**Instrumen Penilaian Nilai Tugas (NT) · Bobot Modul: 17,1% (Maksimal 10 Poin)**

---

**Identitas Peserta:**
- **Nama Peserta:** ____________________
- **NIP / Kode Peserta:** ____________________ (contoh: `p01`)
- **Virtual Host / Alamat Broker:** ____________________ (contoh: `/` atau `lab1-p01` pada `localhost:5672`)
- **Tanggal Praktik:** ____________________

---

### Rubrik Penilaian (Total: 10 Poin)

| Komponen Bukti | Bagian Praktik | Poin | Deskripsi Kriteria Kelulusan |
|---|---|:---:|---|
| **1. Definisi Publisher Confirm vs Manual Ack** | Bagian 3a & 3b | 2 | Ketepatan penjelasan konseptual perbedaan batas garansi antara broker dan database. |
| **2. Bukti Crash Window & Deduplikasi** | Bagian 3b | 2 | Bukti log committed $\rightarrow$ force-kill $\rightarrow$ restart dengan `redelivered: true` dan `duplicate: true`, DB tetap 1 baris. |
| **3. Bukti Rekonsiliasi 100 Pesan Outage** | Bagian 3c | 3 | Bukti seluruh 100 ID dari `.evidence/mati01.json` berhasil dipulihkan tanpa hilang ke database PostgreSQL. |
| **4. Tabel Komparasi & Analisis Prefetch** | Bagian 3d | 3 | Tabel komparasi prefetch 1 vs 100 terisi lengkap dari log metrik worker disertai analisis bottleneck I/O database. |
| **Total Nilai Tugas Lab 3** | | **10** | **Konversi Bobot: 17,1% NT** |

---

### Bagian 1 — Bukti Publisher Confirm & Pemahaman Konseptual (Bobot: 2 Poin)

#### 1.1 Cuplikan Bukti Respons HTTP 202 (`.evidence/awal.json`)
*(Salin objek JSON hasil pengiriman `npm run kirim -- --count=1 --run=awal` di Terminal E)*
```json
{
  "runId": "awal",
  "requested": 1,
  "confirmed": 1,
  "failure": null,
  "publishWallMs": 0,
  "receipts": [
    {
      "status": "DITERIMA_BROKER",
      "pengajuanId": "SIM-awal-...",
      "messageId": "evt-...",
      "correlationId": "corr-...",
      "durasiMs": 0
    }
  ]
}
```

#### 1.2 Analisis Konseptual Confirm vs Acknowledgment
Jawab dua pertanyaan teknis berikut dengan ringkas dan tepat:

1. **Apa arti status HTTP 202 `DITERIMA_BROKER` pada Gateway? Apakah saat status ini dikembalikan, data pengajuan sudah tersimpan di database PostgreSQL?**  
   *Jawaban:* ____________________________________________________________________________________________________  
   ____________________________________________________________________________________________________

2. **Apa fungsi pemanggilan `channel.ack(message)` pada Consumer? Mengapa di kode `layanan/worker.js`, fungsi `ack` baru dipanggil SETELAH transaksi `INSERT` database selesai, bukan sebelumnya?**  
   *Jawaban:* ____________________________________________________________________________________________________  
   ____________________________________________________________________________________________________

---

### Bagian 2 — Bukti Crash Window & Idempotensi Nyata (Bobot: 2 Poin)

#### 2.1 Cuplikan Log Terminal B saat Force Kill
*(Salin log Terminal B saat worker dengan `VALIDASI_ACK_DELAY_MS=10000` mencetak `committed: true` sebelum dihentikan dengan `kill -9`)*
```text
{"service":"validasi","worker":"validasi-...","ready":true,"queue":"validasi.q","prefetch":1,"poolMax":4,"workMs":120}
{"service":"validasi","worker":"validasi-...","committed":true,"messageId":"evt-...","pengajuanId":"SIM-crash01-...","duplicate":false,"redelivered":false}
[Proses dihentikan paksa via kill -9]
```

#### 2.2 Cuplikan Log Terminal B saat Worker Dinyalakan Kembali
*(Salin log Terminal B saat worker dinyalakan kembali dalam kondisi normal dan mendeteksi redelivery)*
```text
{"service":"validasi","worker":"validasi-...","ready":true,"queue":"validasi.q","prefetch":1,"poolMax":4,"workMs":120}
{"service":"validasi","worker":"validasi-...","committed":true,"messageId":"evt-...","pengajuanId":"SIM-crash01-...","duplicate":true,"redelivered":true}
```

#### 2.3 Output Rekonsiliasi Database (`npm run hasil -- crash01`)
```json
{"runId":"crash01","validationRows":1,"trackingRows":0}
```

#### 2.4 Analisis Jendela Kegagalan (Crash Window)
Mengapa tabel `pengajuan` di PostgreSQL tidak menduplikasi baris pengajuan meskipun broker mengirimkan ulang event yang sama (*redelivered*)? Jelaskan mekanisme kode program yang mencegahnya!  
*Jawaban:* ____________________________________________________________________________________________________  
____________________________________________________________________________________________________

---

### Bagian 3 — Bukti Ketahanan Outage & Rekonsiliasi 100 Pesan (Bobot: 3 Poin)

#### 3.1 Status Antrean Saat Consumer Mati
- Jumlah pesan pada kolom **Ready** di antrean `validasi.q` (Management UI) sebelum worker dinyalakan: `______` pesan.
- Jumlah baris database saat consumer mati (`npm run hasil -- mati01` sebelum restart): `validationRows: ______`.

#### 3.2 Cuplikan Bukti `.evidence/mati01.json`
```json
{
  "runId": "mati01",
  "requested": 100,
  "confirmed": 100,
  "failure": null
}
```

#### 3.3 Output Rekonsiliasi Database Akhir (`npm run hasil -- mati01`)
*(Jalankan setelah worker dinyalakan kembali dan antrean terkuras habis)*
```json
{"runId":"mati01","validationRows":100,"trackingRows":0}
```

#### 3.4 Kesimpulan Pengujian Outage
Apakah terdapat pesan yang hilang, terlewati, atau duplikat selama service validasi mengalami *downtime*? Berikan kesimpulan teknis Anda berdasarkan pencocokan jumlah receipts dan baris database!  
*Jawaban:* ____________________________________________________________________________________________________  
____________________________________________________________________________________________________

---

### Bagian 4 — Tabel Komparasi & Analisis Prefetch (Bobot: 3 Poin)

#### 4.1 Tabel Komparasi Pengukuran Nyata (120 Pesan, 3 Worker, Pool Max 4)
*(Isi tabel berikut berdasarkan baris log akhir `"final": true` dari masing-masing worker w1, w2, w3, dan `npm run hasil`)*

| Parameter / Metrik Evaluasi | Eksperimen 1: Prefetch = 1 | Eksperimen 2: Prefetch = 100 |
|---|:---:|:---:|
| Total Waktu Selesai (*wall clock elapsed time*) | `______` ms | `______` ms |
| Distribusi Pesan Diterima (`received`: w1 / w2 / w3) | `___` / `___` / `___` | `___` / `___` / `___` |
| Puncak Pesan In-Flight per Worker (`maxInFlight`) | `______` | `______` |
| Puncak Antrean Koneksi Database (`maxPoolWaiting`) | `______` | `______` |
| Total Baris Database Tersimpan (`validationRows`) | `120` | `120` |
| Akumulasi Waktu CPU Worker (`cpuMs`: w1 / w2 / w3) | `___` / `___` / `___` ms | `___` / `___` / `___` ms |

#### 4.2 Analisis Teknis & Bottleneck (Jawab 3 Pertanyaan Refleksi)
1. **Mengapa Prefetch = 100 mampu menyelesaikan 120 pesan lebih cepat daripada Prefetch = 1 pada pengujian ini?**  
   *Petunjuk: Hubungkan antara prefetch, beban kerja simulasi I/O `pg_sleep`, dan batas kapasitas pool database (4 koneksi × 3 worker = 12 koneksi).*  
   *Jawaban:* ____________________________________________________________________________________________________  
   ____________________________________________________________________________________________________

2. **Mengapa Prefetch = 100 TIDAK BOLEH disimpulkan sebagai konfigurasi yang selalu lebih baik untuk semua sistem produksi?**  
   *Petunjuk: Apa yang terjadi jika jenis pekerjaan consumer bervariasi durasinya (misalnya ada berkas yang selesai 10 ms dan ada yang 5 detik) atau bersifat komputasi CPU berat?*  
   *Jawaban:* ____________________________________________________________________________________________________  
   ____________________________________________________________________________________________________

3. **Apa risiko arsitektur yang terjadi jika worker dengan Prefetch = 100 mengalami crash fatal di tengah pemrosesan?**  
   *Petunjuk: Ke mana perginya puluhan pesan yang sudah terlanjur ditarik ke dalam memori proses worker tersebut?*  
   *Jawaban:* ____________________________________________________________________________________________________  
   ____________________________________________________________________________________________________

---

### Bagian 5 — Lampiran Hasil Verifikasi Otomatis (`npm run verify:day3`)
*(Salin baris PASS dari output pengujian suite QA terisolasi)*
```text
PASS consumer outage: 100 confirmed HTTP receipts match 100 stored IDs
PASS mandatory return rejects an unroutable publish
PASS invalid schema is retained through the predeclared invalid DLX
PASS crash after commit plus explicit replay: one business row, duplicate observed
PASS prefetch 1
PASS prefetch 100
PASS database statement failure stops consumer; manual restart recovers delivery
PASS fanout: both subscriptions receive copies; tracking outage does not stop validation
PASS incompatible topology rejects publisher startup and closes its connection
PASS runtime versions
```
