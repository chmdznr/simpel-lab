# Lab 4A — Fanout Exchange & Independent Subscriptions

**Modul MP-07 (Bagian 1) · Hari 3 (Rabu, 16 September 2026) · Praktik 45 Menit.**

Modul MP-07 dialokasikan total 4 JP yang dibagi dalam dua hari:
- **Hari 3 (Lab 4A - 45 Menit):** Teori pola routing dan praktik Fanout Exchange untuk broadcast event ke banyak subscriber independen.
- **Hari 4 (Lab 4B - 90 Menit):** Praktik Topic Routing lanjutan, delayed retry berbasis DLX & TTL, serta penanganan Dead-Letter Queue (DLQ). Lihat panduan di [`README-part2.md`](README-part2.md).

---

## Target Pembelajaran dan Batasan Desain

Satu event pengajuan yang diterima sistem harus menghasilkan dua catatan independen: satu di service **Validasi** dan satu di service **Tracking**.
- Menempatkan dua worker pada **satu queue yang sama** akan membagi beban kerja (*competing consumers*).
- Menyediakan salinan event yang sama ke **dua service berbeda** mewajibkan pembuatan **dua queue terpisah** (*publish-subscribe*).
- Event `pengajuan.diterima` yang masuk ke antrean tracking hanya membuktikan penerimaan event di awal alur, bukan bukti bahwa proses validasi atau billing telah selesai.

Eksperimen Lab 4A menggunakan Fanout Exchange `simpel.fanout` yang diikat (*bind*) ke dua antrean: `validasi.fanout.q` dan `tracking.q`. Queue ini berdiri sendiri dan tidak mengganggu antrean `validasi.q` dari Lab 3.

---

## Deliverable yang Dikumpulkan (Laporan Praktik)

Praktik Lab 4 mencakup modul MP-07 Bagian 1 (Hari 3) dan Bagian 2 (Hari 4) dengan **bobot Nilai Tugas (NT) sebesar 11,4% (Total 10 Poin)**:
- **Template Laporan:** Gunakan formulir pelaporan terpadu di **[`lembar-laporan.md`](lembar-laporan.md)**.
- **Format Pengumpulan:** Kumpulkan salinan laporan dengan nama: `lab4-<nama-atau-nip-peserta>.md` (atau `.pdf`).
- **Komponen Penilaian:**
  - *Bagian A (Lab 4A - 3 Poin):* Bukti broadcast 1 event ke 2 queue (`fan01`), bukti isolasi tracking downtime (`trackoff`), dan rekonsiliasi data pemulihan.
  - *Bagian B (Lab 4B - 7 Poin):* Matriks topic routing & alternate exchange (3 poin), serta siklus delayed retry TTL, karantina DLQ, dan replay terkendali (4 poin).

---

## Prasyarat Lingkungan dan Terminal

Jalankan seluruh perintah dari **root repository `simpel-lab/`**, dengan Node.js >= 20.6, Docker aktif, dan konfigurasi `.env` siap:

```bash
# Salin konfigurasi template jika file .env belum ada
cp -n .env.contoh .env

# Pastikan container broker dan database aktif
docker compose up -d rabbitmq postgres

# Pastikan port 3001 bebas dari proses sebelumnya
lsof -ti :3001 | xargs kill -9 2>/dev/null

# Siapkan skema database lab
npm run db:siapkan
```

> **Deklarasi Topologi Otomatis:** Sama seperti Lab 3, antrean `simpel.fanout`, `validasi.fanout.q`, dan `tracking.q` otomatis dideklarasikan secara idempoten oleh kode aplikasi saat gateway/worker dinyalakan dengan `SIMPEL_MODE=fanout`. Anda tidak perlu membuatnya secara manual di Management UI.

---

## Tahapan Praktik (45 Menit)

### 1. Menit 0–5: Prediksi Alur Fanout
Buat sketsa diagram satu Fanout Exchange yang terhubung ke dua queue terpisah. Buat prediksi tertulis: apa yang terjadi jika salah satu subscriber (misalnya service Tracking) mati saat event dipublish?

### 2. Menit 5–10: Persiapan Proses Terminal
Hentikan Gateway dan seluruh worker dari Lab 3 (`Ctrl+C`). Pastikan port 3001 sudah bebas dari proses sebelumnya (sudah dijalankan pada langkah prasyarat di atas).

### 3. Menit 10–15: Menjalankan Stack Fanout
Buka tiga tab terminal terpisah di root folder `simpel-lab/`:

```bash
# Terminal A (Gateway mode fanout):
SIMPEL_MODE=fanout npm run broker:gateway

# Terminal B (Worker Validasi):
SIMPEL_MODE=fanout WORKER_ID=vfan npm run broker:validasi

# Terminal C (Worker Tracking):
SIMPEL_MODE=fanout WORKER_ID=track npm run broker:tracking
```

Perhatikan pesan log terminal: pastikan masing-masing worker berhasil mendeklarasikan antreannya dan menampilkan status ready.

### 4. Menit 15–20: Satu Event, Dua Subscriber Independen
Di terminal lain (Terminal D/E), kirim 10 event pengajuan:
```bash
npm run kirim -- --count=10 --run=fan01
npm run hasil -- fan01
```

Setelah antrean terkuras (*drained*), amati hasilnya: `validationRows: 10` dan `trackingRows: 10`.
Cocokkan ID pengajuan di kedua tabel; kedua consumer menerima `messageId` yang sama persis. Ini membuktikan bahwa 10 event yang dipublish oleh Gateway berhasil disalin oleh broker ke kedua queue pelanggan secara simultan.

### 5. Menit 20–25: Eksperimen Subscriber Down (Tracking Offline)
Hentikan hanya service tracking di Terminal C (`Ctrl+C`). Biarkan Gateway dan Validasi tetap berjalan. Kirim 5 event pengajuan baru:
```bash
npm run kirim -- --count=5 --run=trackoff
npm run hasil -- trackoff
```

Amati perbedaannya:
- Service Validasi tetap memproses pesan secara normal (`validationRows` bertambah 5 menjadi 5).
- Di RabbitMQ Management UI, antrean `tracking.q` menumpuk 5 pesan (kolom **Ready: 5**).
- Hasil query `npm run hasil -- trackoff` membuktikan bahwa `validationRows: 5` dan `trackingRows: 0`. Keterlambatan atau matinya service Tracking sama sekali tidak menghambat jalannya proses Validasi!

### 6. Menit 25–30: Pemulihan Subscriber (Recovery)
Nyalakan kembali service Tracking di Terminal C:
```bash
SIMPEL_MODE=fanout WORKER_ID=track npm run broker:tracking
```

Amati bahwa antrean `tracking.q` langsung menguras 5 pesan yang tertahan. Periksa kembali database:
```bash
npm run hasil -- trackoff
```
Hasil query kini membuktikan `validationRows: 5` dan `trackingRows: 5`. Seluruh data tracking berhasil mengejar ketertinggalan tanpa ada pesan yang hilang!

> **Poin Diskusi Kritis:** Mengapa event yang dipublish SEBELUM queue/binding dibuat tidak akan pernah diterima oleh subscriber baru? (Ingat bahwa RabbitMQ queue bersifat ephemeral/durable point-in-time subscription, bukan replayable event store seperti Kafka!).

### 7. Menit 30–35: Matriks Perutean Topic (Persiapan Lab 4B)
Buka file [`layanan/messaging.js`](../../layanan/messaging.js).
Ingat kembali perbedaan mendasar:
- **Fanout Exchange:** Mem-broadcast pesan ke seluruh antrean yang terikat tanpa mengevaluasi routing key sama sekali.
- **Topic Exchange:** Mengevaluasi routing key berdasarkan pola wildcard:
  - Tanda bintang (`*`) mencocokkan **tepat satu kata/segmen**.
  - Tanda pagar (`#`) mencocokkan **nol atau lebih kata/segmen**.

Uji pemahaman: jika ada binding `pengajuan.*.jakarta` dan `pengajuan.siup.#`, routing key `pengajuan.siup.jakarta.revisi` akan masuk ke queue mana? (Jawaban: hanya masuk ke queue dengan binding `pengajuan.siup.#`).

---

## Tabel Penanganan Kasus Kegagalan

| Skenario Insiden | Indikator yang Terlihat di Sistem | Tindakan Korektif |
|---|---|---|
| **Consumer Tracking mati** | Kolom Ready pada `tracking.q` meningkat, Validasi berjalan normal | Nyalakan kembali worker tracking; antrean otomatis diproses |
| **Tidak ada binding yang cocok (*unroutable*)** | Muncul event `basic.return` pada publisher (jika `mandatory: true`) | Perbaiki konfigurasi binding, lakukan rekonsiliasi data |
| **Kontrak JSON cacat/rusak** | Jumlah pesan pada antrean `pengajuan.invalid` bertambah | Karantina pesan, periksa schema contract, beri tahu tim hulu |
| **Koneksi Database Worker putus** | Worker berhenti konsumsi, pesan yang belum di-ack di-requeue | Pulihkan database, jalankan kembali worker |
| **Dependensi eksternal mati berulang** | Antrean menumpuk, worker terancam looping error tanpa henti | Terapkan pola Delayed Retry & DLQ berjadwal (dibahas di Lab 4B) |

---

## Checklist Kelulusan Lab 4A

- [ ] Berhasil mendemonstrasikan replikasi pesan ke dua antrean independen via Fanout Exchange.
- [ ] Membuktikan decoupling: service Validasi tetap berjalan normal saat service Tracking mati.
- [ ] Membuktikan recovery: pesan pada `tracking.q` tidak hilang dan diproses tuntas saat worker dinyalakan kembali.
- [ ] Memahami batasan replikasi broker: publish yang dilakukan sebelum binding terpasang tidak dapat direplay secara otomatis.

Lanjutkan ke **[Lab 4B (Topic Routing, Delayed Retry, & DLQ)](README-part2.md)** untuk mengonfigurasi mekanisme penanganan kegagalan tingkat lanjut.
