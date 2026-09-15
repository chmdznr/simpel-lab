# Lab 4 — Lembar Laporan Praktik Topologi Routing, Delayed Retry, & DLQ

**Modul MP-07 (Part 1 & Part 2) · Hari 3 & Hari 4 · Praktik 4 JP (180 Menit)**  
**Instrumen Penilaian Nilai Tugas (NT) · Bobot Modul: 11,4% (Maksimal 10 Poin)**

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
| **1. Fanout & Subscriptions Independen** | Lab 4A (Hari 3) | 3 | Bukti broadcast 1 event ke 2 queue (`fan01`), bukti isolasi saat tracking offline (`trackoff`), dan pemulihan tracking tanpa kehilangan data. |
| **2. Matriks Prediksi Topic & Alternate Exchange** | Lab 4B (Hari 4) | 3 | Tabel matriks routing terisi lengkap berdasarkan 3 kasus uji (`siup.jakarta`, `nib.bandung`, `siup.bandung`) dan penjelasan wildcard `*` vs `#`. |
| **3. Delayed Retry (TTL + DLX) & Replay DLQ** | Lab 4B (Hari 4) | 4 | Bukti siklus 3 kali percobaan retry dengan jeda 2.000 ms, karantina ke DLQ, serta prosedur inspect, peek, dan redrive terkendali. |
| **Total Nilai Tugas Lab 4** | | **10** | **Konversi Bobot: 11,4% NT** |

---

## BAGIAN A: Lab 4A — Fanout Exchange & Independent Subscriptions (Hari 3 Sore · 3 Poin)

### A.1 Pengujian Broadcast (10 Event Normal)
*(Jalankan `npm run kirim -- --count=10 --run=fan01` saat kedua worker menyala)*

1. **Output Rekonsiliasi Database (`npm run hasil -- fan01`):**
   ```json
   {"runId":"fan01","validationRows":10,"trackingRows":10}
   ```
2. **Analisis Broadcast:** Apakah kedua service menerima `messageId` yang sama persis? Mengapa kedua worker tidak saling berebut atau mencuri pesan seperti pada Lab 3?  
   *Jawaban:* ____________________________________________________________________________________________________  
   ____________________________________________________________________________________________________

---

### A.2 Pengujian Isolasi Subscriber Down (Tracking Offline)
*(Hentikan worker tracking di Terminal C, kirim 5 event dengan run ID `trackoff`)*

1. **Output Database saat Tracking Down (`npm run hasil -- trackoff` sebelum restart):**
   ```json
   {"runId":"trackoff","validationRows":5,"trackingRows":0}
   ```
2. **Status Antrean di Management UI:**
   - Kolom **Ready** pada antrean `tracking.q`: `______` pesan.
   - Kolom **Ready** pada antrean `validasi.fanout.q`: `______` pesan.

---

### A.3 Pemulihan Subscriber (Tracking Recovery)
*(Nyalakan kembali worker tracking di Terminal C)*

1. **Output Database Setelah Pemulihan (`npm run hasil -- trackoff` setelah restart):**
   ```json
   {"runId":"trackoff","validationRows":5,"trackingRows":5}
   ```
2. **Kesimpulan Decoupling:** Jelaskan mengapa matinya service Tracking sama sekali tidak menghambat jalannya proses bisnis di service Validasi!  
   *Jawaban:* ____________________________________________________________________________________________________  
   ____________________________________________________________________________________________________

---

## BAGIAN B: Lab 4B — Topic Routing, Delayed Retry, & DLQ (Hari 4 Pagi · 7 Poin)

### B.1 Matriks Perutean Topic & Alternate Exchange
*(Jalankan `npm run routing -- inspect` setelah mempublish ketiga routing key pada Blok 7.3)*

| Routing Key Uji | Binding Match | Queue Jakarta (`lab4b.jakarta.q`) | Queue SIUP (`lab4b.siup.q`) | Queue Cadangan (`lab4b.unmatched.q`) |
|---|---|:---:|:---:|:---:|
| `pengajuan.siup.jakarta` | `pengajuan.*.jakarta` & `pengajuan.siup.*` | `___` | `___` | `___` |
| `pengajuan.nib.bandung` | Tidak ada yang cocok | `___` | `___` | `___` |
| `pengajuan.siup.bandung` | `pengajuan.siup.*` | `___` | `___` | `___` |
| **Total Pesan Ready Terkumpul** | | `+1` | `+2` | `+1` |

**Pertanyaan Refleksi Wildcard:**  
Jelaskan perbedaan mendasar antara wildcard bintang (`*`) dan pagar (`#`) pada Topic Exchange RabbitMQ! Berikan contoh routing key yang cocok dengan `pengajuan.#` tetapi DITOLAK oleh `pengajuan.*.*`!  
*Jawaban:* ____________________________________________________________________________________________________  
____________________________________________________________________________________________________

---

### B.2 Simulasi Delayed Retry (Transient Failure)
*(Kirim `npm run routing -- job 2` di Terminal B saat worker di Terminal A berjalan)*

1. **Catat Log Siklus Percobaan Worker:**
   - **Attempt 1:** Result: `retry` (Pesan dialihkan ke queue retry dengan TTL 2.000 ms).
   - **Attempt 2:** Result: `retry` (Pesan kembali dari TTL melalui DLX, dicoba lagi).
   - **Attempt 3:** Result: `processed` (Pesan berhasil diselesaikan).
2. **Analisis Mekanisme:** Bagaimana RabbitMQ mengembalikan pesan dari antrean retry kembali ke antrean kerja tanpa memerlukan cron job atau scheduler eksternal?  
   *Jawaban:* ____________________________________________________________________________________________________  
   ____________________________________________________________________________________________________

---

### B.3 Simulasi Kegagalan Permanen & Karantina DLQ
*(Kirim `npm run routing -- job 99` di Terminal B)*

1. **Status Antrean Akhir (`npm run routing -- inspect`):**
   - Pesan pada `lab4b.work.q`: `______`
   - Pesan pada `lab4b.retry.q`: `______`
   - Pesan pada `lab4b.dlq.q`: `______`

2. **Cuplikan Output Peek DLQ (`npm run routing -- peek`):**
   ```json
   {
     "event": {
       "event": "pengajuan.diterima",
       "messageId": "evt-...",
       "data": { "pengajuanId": "SIM-routing-..." }
     },
     "headers": {
       "attempt": 3,
       "failUntil": 99
     }
   }
   ```
   *Salin `messageId` untuk persiapan replay:* `evt-________________________`

---

### B.4 Perbaikan Dependensi & Replay Terkendali (Redrive)
*(Hentikan worker lama, jalankan worker sehat `LAB4_REPAIRED=1`, lalu replay pesan dari DLQ)*

1. **Cuplikan Output Replay (`LAB4_REPAIRED=1 npm run routing -- replay <messageId>`):**
   ```json
   {"replayed":"evt-..."}
   ```
2. **Log Worker saat Replay Diproses:**
   ```json
   {"messageId":"evt-...","attempt":1,"result":"processed","redelivered":false}
   ```
3. **Verifikasi Antrean Akhir (`npm run routing -- inspect`):**
   - Pesan pada `lab4b.dlq.q` berkurang menjadi: `0` pesan.

4. **Peringatan Operasional DLQ:**  
   Mengapa tim engineering dilarang keras melakukan redrive/replay massal seluruh isi DLQ secara otomatis begitu terjadi insiden di produksi? Sebutkan dua prasyarat mutlak yang wajib dipenuhi sebelum melakukan replay!  
   *Jawaban:*  
   Prasyarat 1: _________________________________________________________________________________________________  
   Prasyarat 2: _________________________________________________________________________________________________  
