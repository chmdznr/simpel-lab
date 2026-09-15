# Lab 5 — Lembar Laporan Praktik Integrasi Microservices & Uji Beban

**Modul MP-08 · Hari 4 (Kamis, 17 September 2026) · Praktik 3 JP (135 Menit)**  
**Instrumen Penilaian Nilai Tugas (NT) · Bobot Modul: 14,3% (Maksimal 10 Poin)**

---

**Identitas Peserta:**
- **Nama Peserta:** ____________________
- **NIP / Kode Peserta:** ____________________ (contoh: `p01`)
- **Virtual Host / Alamat Broker:** ____________________ (contoh: `amqp://simpel:simpel123@localhost:5672`)
- **Tanggal Praktik:** ____________________

---

### Rubrik Penilaian (Total: 10 Poin)

| Komponen Bukti | Bagian Praktik | Poin | Deskripsi Kriteria Kelulusan |
|---|---|:---:|---|
| **1. Alur End-to-End & Idempotensi Gateway** | Lab 5a | 3 | Bukti alur lengkap 5 service berjalan, polling status mencapai `SELESAI`, bukti konsistensi data di 4 tabel (`alur_pengajuan`, `alur_outbox`, `alur_inbox`, `alur_tracking`), serta penolakan HTTP 409 saat reuse key dengan payload berbeda. |
| **2. Downtime Billing & Saga Kompensasi** | Lab 5b | 3 | Bukti ketahanan saat service Billing down (HTTP 202 tetap terbit, backlog menampung di broker), pemulihan otomatis saat Billing start, dan eksekusi kompensasi Saga saat fault injection `uji-gagal` (reservasi dibatalkan). |
| **3. Komparasi Uji Beban Burst 500 (Dua Jam Ukur)** | Lab 5c | 4 | Tabel perbandingan metrik 500 request (Sync vs Async: p95 response time, p95 completion time, utilisasi DB pool) terisi lengkap disertai analisis arsitektural keunggulan asinkron. |
| **Total Nilai Tugas Lab 5** | | **10** | **Konversi Bobot: 14,3% NT** |

---

## BAGIAN 1: Lab 5a — Alur End-to-End, Polling Status, & Idempotensi (3 Poin)

### 1.1 Bukti Respons Gateway & Polling Status
*(Kirim pengajuan menggunakan curl atau script node di langkah 2)*

1. **Respons Awal Gateway (HTTP 202 Accepted):**
   ```json
   {
     "status": "DITERIMA",
     "pengajuanId": "SIM-...",
     "statusUrl": "/pengajuan/SIM-.../status"
   }
   ```

2. **Perjalanan Status Permohonan Hasil Polling:**
   - Status 1: `DITERIMA`
   - Status 2: `VALID`
   - Status 3: `BILLING_TERBIT`
   - Status Akhir: `SELESAI` (Nomor Billing: `BIL-...`)

---

### 1.2 Verifikasi Konsistensi Data di PostgreSQL
*(Jalankan query SQL berikut di terminal psql atau tool database)*

```sql
SELECT layanan, count(*) FROM alur_inbox GROUP BY layanan;
SELECT event, count(*) FROM alur_tracking GROUP BY event;
SELECT owner, count(*) FROM alur_outbox WHERE published_at IS NULL GROUP BY owner;
```

**Salin Hasil Query:**
```text
[ Tempelkan output query tabel alur_inbox, alur_tracking, dan alur_outbox di sini ]
```

*Verifikasi Outbox & Inbox:*
- Apakah ada baris di `alur_outbox` yang memiliki `published_at IS NULL`? (Harus 0 / semua ter-publish): `______`
- Mengapa tabel `alur_inbox` diperlukan pada masing-masing consumer?  
  *Jawaban:* ____________________________________________________________________________________________________  
  ____________________________________________________________________________________________________

---

### 1.3 Uji Idempotensi Request Gateway
1. **Pengiriman Ulang dengan Idempotency-Key & Payload Sama:**
   - Status HTTP: `HTTP 200 OK` / `HTTP 202 Accepted`
   - Apakah `pengajuanId` yang dikembalikan identik?: `[ Ya / Tidak ]`
   - Apakah database membuat baris pengajuan ganda?: `[ Ya / Tidak ]`

2. **Pengiriman Ulang dengan Idempotency-Key Sama tetapi Payload Berbeda:**
   - Status HTTP: `HTTP 409 Conflict`
   - Pesan Error: `__________________________________________________`

---

## BAGIAN 2: Lab 5b — Simulasi Downtime Billing & Kompensasi Saga (3 Poin)

### 2.1 Ketahanan Sistem saat Service Billing Mati
*(Hentikan service Billing dengan `Ctrl+C`, lalu kirim pengajuan baru)*

1. **Respons Gateway ke Klien:**  
   Apakah Gateway tetap mengembalikan `HTTP 202 Accepted` meskipun service Billing mati?  
   *Jawaban:* `[ Ya / Tidak ]` (Latensi respons: `______` ms).
2. **Posisi Antrean di RabbitMQ Management UI:**  
   - Jumlah pesan Ready di antrean `alur.billing.q`: `______` pesan.
   - Status terakhir permohonan di tabel tracking: `VALID`.

---

### 2.2 Pemulihan Service Billing (Automatic Drain)
*(Nyalakan kembali service Billing: `npm run alur:billing`)*

1. **Perilaku Sistem:**  
   Apakah klien perlu mengirim ulang request agar permohonan selesai?  
   *Jawaban:* ____________________________________________________________________________________________________
2. **Status Akhir di Database Tracking:**  
   Status permohonan berhasil tuntas menjadi: `SELESAI`.

---

### 2.3 Simulasi Kegagalan Bisnis & Kompensasi Saga (Fault Injection)
*(Kirim permohonan dengan parameter `jenis: 'uji-gagal'`)*

1. **Alur Karantina & Deteksi Kegagalan:**  
   - Setelah percobaan retry berulang, event gagal dialihkan ke queue: `alur.billing.dlq`.
   - Event yang dipublish oleh service Billing: `billing.gagal`.
2. **Tindakan Kompensasi oleh Service Validasi:**  
   - Status reservasi di tabel `alur_validasi`: Berubah dari `'reserved'` menjadi `'cancelled'`.
   - Event kompensasi yang dipublish ke broker: `pengajuan.dibatalkan`.
   - Status terminal di audit trail tracking: `DIBATALKAN`.
3. **Refleksi Teknis:** Mengapa kompensasi pada arsitektur terdistribusi bukanlah rollback transaksi SQL langsung melainkan transaksi bisnis baru ke arah depan (*forward transaction*)?  
   *Jawaban:* ____________________________________________________________________________________________________  
   ____________________________________________________________________________________________________

---

## BAGIAN 3: Lab 5c — Komparasi Uji Beban Burst 500 (Dua Jam Pengukuran · 4 Poin)

### 3.1 Tabel Hasil Pengujian Beban 500 Request (50 Konkurensi Paralel)
*(Jalankan benchmark `node --env-file=.env tools/beban-alur.js` pada Mode Sinkron dan Asinkron)*

| Parameter & Metrik Pengukuran | Mode Synchronous (HTTP Serial) | Mode Asynchronous (RabbitMQ + Outbox) |
|---|:---:|:---:|
| **Total Request Dikirim** | 500 | 500 |
| **Request Berhasil Selesai** | `______` | `______` |
| **Error / Timeout (HTTP 500 / 504)** | `______` | `______` |
| **HTTP Response Time (p95)** | `______` ms | `______` ms |
| **Workflow Completion Time (p95)** | `______` ms | `______` ms |
| **Puncak Koneksi DB Sleep (`peakPgSleep`)** | `______` | `______` |

---

### 3.2 Analisis Teknis & Prinsip Dua Jam Pengukuran

1. **Mengapa nilai HTTP Response Time p95 pada mode Asinkron (~2–5 ms) jauh lebih cepat daripada mode Sinkron (~3.500–7.000 ms)?**  
   *Analisis:* ____________________________________________________________________________________________________  
   ____________________________________________________________________________________________________

2. **Mengapa nilai Completion Time p95 pada mode Asinkron tetap memakan waktu hingga puluhan detik? Jelaskan konsep "Dua Jam Pengukuran"!**  
   *Analisis:* ____________________________________________________________________________________________________  
   ____________________________________________________________________________________________________

3. **Berdasarkan metrik `peakPgSleep` dan koneksi database, mengapa mode Asinkron dengan batas pool `ALUR_POOL_MAX=4` dan `ALUR_PREFETCH=4` mampu mencegah insiden database crash / connection exhaustion di lingkungan produksi?**  
   *Analisis:* ____________________________________________________________________________________________________  
   ____________________________________________________________________________________________________

---

## BAGIAN 4: Verifikasi Otomatis (`verify:day4`)

Jalankan perintah verifikasi integrasi terisolasi:
```bash
npm run verify:day4
```

**Bukti Lulus Uji Otomatis:**
```text
[ Salin ringkasan PASS 12 skenario pengujian di sini ]
```
- Status Verifikasi Otomatis: **[ PASS / FAIL ]**
