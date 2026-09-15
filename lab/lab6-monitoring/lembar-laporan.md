# Lab 6 — Lembar Laporan Praktik Monitoring, Alerting, & Kontrol Akses

**Modul MP-09 · Hari 5 (Jumat, 18 September 2026) · Praktik 4 JP (180 Menit)**  
**Instrumen Penilaian Nilai Tugas (NT) · Bobot Modul: 11,4% (Maksimal 10 Poin)**

---

**Identitas Peserta:**
- **Nama Peserta:** ____________________
- **NIP / Kode Peserta:** ____________________ (contoh: `p01`)
- **Virtual Host / Alamat Broker:** ____________________ (contoh: `amqp://labops:labops-only@127.0.0.1:5775/lab6`)
- **Tanggal Praktik:** ____________________

---

### Rubrik Penilaian (Total: 10 Poin)

| Komponen Bukti | Bagian Praktik | Poin | Deskripsi Kriteria Kelulusan |
|---|---|:---:|---|
| **1. Observasi Grafana & Prometheus Alerting** | Bagian 1 | 3 | Bukti pemantauan antrean di Grafana saat backlog 100 pesan, pencatatan alert `SimpelQueueWithoutConsumer` bertransisi ke *Firing*, dan pemulihan otomatis saat worker dinyalakan. |
| **2. Analisis Query PromQL Metrik Broker** | Bagian 2 | 3 | Ketepatan penjelasan teknis 3 query PromQL: pembacaan antrean ready, kalkulasi ack rate, dan status ketersediaan proses broker (`up`). |
| **3. Pembuktian Least Privilege User Publisher** | Bagian 3 | 4 | Bukti hasil uji probe keamanan pada user `lab6-publisher`: publikasi ke `lab6.events` sukses, sedangkan deklarasi resource, konsumsi queue, dan publikasi ke exchange lain ditolak dengan error 403. |
| **Total Nilai Tugas Lab 6** | | **10** | **Konversi Bobot: 11,4% NT** |

---

## BAGIAN 1: Observasi Grafana & Alerting Prometheus (3 Poin)

### 1.1 Simulasi Backlog 100 Pesan Saat Consumer Mati
*(Jalankan `npm run operasi -- publish 100` sebelum menyalakan consumer)*

1. **Snapshot Metrik Antrean (`npm run operasi -- snapshot`):**
   ```text
   [ Salin baris snapshot metrik antrean lab6.q di sini ]
   ```
   - Jumlah Pesan Ready: `______` pesan.
   - Jumlah Pesan Unacked: `______` pesan.
   - Jumlah Consumers: `______` consumer.

2. **Pengamatan Alert di Prometheus (`http://127.0.0.1:9095/alerts`):**
   - Nama Alert Rule: `SimpelQueueWithoutConsumer`
   - Kondisi Pemicu (*Expression*): `rabbitmq_queue_messages_ready > 0 and rabbitmq_queue_consumers == 0`
   - Status Alert setelah 15 detik: **[ Pending / Firing ]**
   - Mengapa alert ini sangat krusial di lingkungan produksi pemda?  
     *Jawaban:* ____________________________________________________________________________________________________  
     ____________________________________________________________________________________________________

---

### 1.2 Pemulihan Antrean Saat Worker Dinyalakan
*(Di Terminal 2, jalankan `npm run operasi -- consumer`)*

1. **Pengamatan Kurva di Grafana Dashboard (`http://127.0.0.1:3005/d/simpel-ops`):**
   - Perilaku kurva *Messages Ready*: Berangsur-angsur turun dari 100 menuju 0.
   - Nilai *Ack Rate*: Naik stabil mencerminkan kecepatan pemrosesan worker (~200 ms/pesan).
2. **Status Akhir Alert di Prometheus:**
   - Status alert beralih menjadi: **[ Inactive / Resolved ]**.

---

## BAGIAN 2: Analisis Query PromQL Metrik Broker (3 Poin)

Jelaskan makna teknis dan relevansi operasional dari ketiga query PromQL berikut:

1. **Query 1: `rabbitmq_queue_messages_ready{vhost="lab6"}`**  
   - Tipe Metrik: *Gauge*
   - Makna Teknis: ______________________________________________________________________________________________  
   - Kapan metrik ini harus memicu peringatan (*warning*) ke tim SRE?:  
     *Jawaban:* ____________________________________________________________________________________________________

2. **Query 2: `rate(rabbitmq_detailed_queue_messages_acked_total{vhost="lab6"}[1m])`**  
   - Tipe Metrik: *Counter dengan fungsi rate()*
   - Makna Teknis: ______________________________________________________________________________________________  
   - Mengapa throughput pesan diukur menggunakan `rate()` per menit, bukan nilai absolut counter?  
     *Jawaban:* ____________________________________________________________________________________________________

3. **Query 3: `up{job="rabbitmq"}`**  
   - Makna Nilai `1` vs `0`: ____________________________________________________________________________________  
   - Apakah nilai `1` menjamin bahwa seluruh antrean berjalan lancar tanpa kendala? Jelaskan batasannya!  
     *Jawaban:* ____________________________________________________________________________________________________

---

## BAGIAN 3: Pembuktian Hak Akses Minimum (*Least Privilege*) Publisher (4 Poin)

### 3.1 Audit Konfigurasi Permissions User `lab6-publisher`
*(Jalankan `npm run operasi -- permissions`)*

Tuliskan konfigurasi hak akses regex untuk user `lab6-publisher` pada vhost `lab6`:
- **Configure regex:** `^$` *(Arti: __________________________________________________)*
- **Write regex:** `^lab6\.events$` *(Arti: ___________________________________________)*
- **Read regex:** `^$` *(Arti: ______________________________________________________)*

---

### 3.2 Bukti Hasil Uji Probe Keamanan
*(Jalankan `npm run operasi -- probe`)*

| Percobaan Operasi oleh `lab6-publisher` | Respon Broker RabbitMQ | Kode Status / Error | Evaluasi Keamanan |
|---|:---:|:---:|:---:|
| **1. Publish ke `lab6.events`** | Berhasil terkirim | `Confirmed` | **[ Lulus / Gagal ]** |
| **2. Publish ke exchange lain (`lab6.other`)** | Ditolak oleh broker | `ACCESS_REFUSED (403)` | **[ Lulus / Gagal ]** |
| **3. Deklarasi Queue Baru (`lab6.hacker.q`)** | Ditolak oleh broker | `ACCESS_REFUSED (403)` | **[ Lulus / Gagal ]** |
| **4. Consume / Get Pesan dari `lab6.q`** | Ditolak oleh broker | `ACCESS_REFUSED (403)` | **[ Lulus / Gagal ]** |

**Refleksi Keamanan Arsitektur:**  
Mengapa service eksternal atau service yang hanya bertugas mengirim event (misal Gateway Pemohon) HARUS dibatasi dengan `configure: ^$` dan `read: ^$`? Ancaman risiko apa yang dicegah oleh pembatasan ini?  
*Jawaban:* ____________________________________________________________________________________________________  
____________________________________________________________________________________________________

---

## BAGIAN 4: Verifikasi Otomatis (`verify:day5`)

Jalankan perintah verifikasi integrasi terisolasi:
```bash
npm run verify:day5
```

**Bukti Lulus Uji Otomatis:**
```text
[ Salin ringkasan PASS pengujian operasional di sini ]
```
- Status Verifikasi Otomatis: **[ PASS / FAIL ]**
