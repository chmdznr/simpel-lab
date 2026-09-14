# Lab 4B — Topic Routing, Delayed Retry, dan DLQ

**Modul MP-07 (Bagian 2) · Hari 4 (Kamis, 17 September 2026) · Praktik 2 JP (90 Menit).**

Lab ini adalah kelanjutan dari Lab 4A. Seluruh latihan dijalankan dari root direktori `simpel-lab/` menggunakan Node.js >= 20.6 dan stack Docker lokal aktif. Semua nama resource menggunakan awalan `lab4b.*` agar tidak mengganggu antrean latihan hari sebelumnya.

---

## Blok 7.3 — Topic Routing Berbasis Jenis Izin dan Wilayah (45 Menit)

*Alokasi waktu: Verifikasi environment (5 m) $\rightarrow$ Prediksi matriks routing (7 m) $\rightarrow$ Uji publish 3 kasus (15 m) $\rightarrow$ Analisis bindings di UI (10 m) $\rightarrow$ Eksplorasi wildcard bertingkat (8 m).*

1. **Persiapan:** Pastikan Docker aktif, lalu inisialisasi topologi routing:
   ```bash
   npm run routing -- setup
   ```
2. **Pahami Aturan Wildcard Topic:**
   - Binding Jakarta: `pengajuan.*.jakarta` (wildcard `*` mencocokkan **tepat 1 kata** di antara `pengajuan` dan `jakarta`).
   - Binding SIUP: `pengajuan.siup.*` (wildcard `*` mencocokkan **tepat 1 kata** setelah `pengajuan.siup`).
   - Alternate Exchange: Exchange `lab4b.unmatched` bertipe fanout disiapkan sebagai jaring penampung pesan yang tidak cocok dengan binding mana pun.
3. **Eksekusi 3 Perintah Publikasi:**
   ```bash
   npm run routing -- publish pengajuan.siup.jakarta
   npm run routing -- publish pengajuan.nib.bandung
   npm run routing -- publish pengajuan.siup.bandung
   npm run routing -- inspect
   ```

### Matriks Hasil Perutean Topic

| Routing Key yang Dipublish | Queue Jakarta | Queue SIUP | Queue Cadangan (*Unmatched*) |
|---|---:|---:|---:|
| `pengajuan.siup.jakarta` | 1 | 1 | 0 |
| `pengajuan.nib.bandung` | 0 | 0 | 1 |
| `pengajuan.siup.bandung` | 0 | 1 | 0 |
| **Pertambahan Pesan Ready** | **+1** | **+2** | **+1** |

4. **Analisis Hasil di Management UI:**
   - Perhatikan bahwa pesan `pengajuan.siup.jakarta` masuk ke DUA queue sekaligus karena cocok dengan kedua binding pattern.
   - Pesan `pengajuan.nib.bandung` tidak cocok dengan kedua antrean utama, sehingga otomatis dialihkan oleh broker ke Alternate Exchange menuju antrean cadangan.
5. **Diskusi Wildcard `*` vs `#`:**
   Pola `pengajuan.*.*` menuntut **tepat 3 segmen kata**, sedangkan pola `pengajuan.#` akan menerima `pengajuan.siup`, `pengajuan.siup.jakarta`, maupun `pengajuan.siup.jakarta.revisi`.

---

## Blok 7.4 — Delayed Retry Berjadwal dan Replay Terkendali (45 Menit)

*Alokasi waktu: Jalankan worker failure (6 m) $\rightarrow$ Uji simulasi retry (8 m) $\rightarrow$ Uji kegagalan permanen ke DLQ (10 m) $\rightarrow$ Replay pesan dari DLQ (12 m) $\rightarrow$ Analisis risiko produksi (9 m).*

Pada latihan ini, mekanisme delayed retry diimplementasikan dengan memanfaatkan fitur **Message TTL** dan **Dead-Letter Exchange (DLX)** bawaan RabbitMQ:
- Pesan gagal dikirim ke antrean retry dengan TTL (misalnya 2.000 ms) tanpa ada consumer.
- Begitu TTL kedaluwarsa, RabbitMQ secara otomatis mendead-letter pesan tersebut kembali ke antrean kerja utama melalui DLX.

### 1. Jalankan Consumer Worker
Di Terminal A, jalankan worker routing:
```bash
npm run routing -- worker
```

### 2. Simulasi Kegagalan Sementara (Transient Failure - Sembuh di Attempt 3)
Di Terminal B, kirim job dengan parameter simulasi gagal 2 kali:
```bash
npm run routing -- job 2
```

Amati log Terminal A:
- Attempt 1: Gagal $\rightarrow$ dialihkan ke antrean retry dengan TTL 2.000 ms.
- Attempt 2: TTL habis, pesan kembali ke antrean kerja $\rightarrow$ dicoba lagi, masih gagal $\rightarrow$ kembali ke retry queue.
- Attempt 3: TTL habis $\rightarrow$ dicoba lagi $\rightarrow$ **berhasil diproses!** (Log: `processed`).

### 3. Simulasi Kegagalan Permanen (Masuk ke DLQ)
Di Terminal B, kirim job yang disimulasikan gagal terus-menerus:
```bash
npm run routing -- job 99
```

Amati log: Worker mencoba hingga attempt ke-3, kemudian menghentikan jadwal retry. Pesan secara permanen dialihkan ke antrean investigasi `lab4b.dlq`.
Periksa isi DLQ tanpa menghapusnya (*peek*):
```bash
npm run routing -- inspect
npm run routing -- peek
```
Salin `messageId` yang berada di antrean terdepan (*head of DLQ*), misalnya `evt-xxxx`.

### 4. Perbaikan Dependensi & Replay Terkendali (Redrive)
Simulasikan bahwa bug atau dependensi telah diperbaiki dengan environment variable `LAB4_REPAIRED=1`. Lakukan replay pesan dari DLQ:

```bash
# Di Terminal A (Restart worker dalam kondisi sehat):
LAB4_REPAIRED=1 npm run routing -- worker

# Di Terminal B (Replay pesan spesifik dari DLQ):
LAB4_REPAIRED=1 npm run routing -- replay evt-ID-DARI-PEEK
```

Amati bahwa:
- Pesan dari DLQ dipublish ulang dengan `messageId` yang tetap sama persis.
- Worker memprosesnya dengan sukses (`processed`), dan jumlah pesan di DLQ berkurang 1.

> **Peringatan Operasional:** Jangan pernah melakukan redrive massal dari DLQ secara membabi buta! Pastikan akar masalah teknis sudah teridentifikasi dan terselesaikan, serta pastikan consumer hilir memiliki proteksi idempotensi agar tidak menghasilkan duplikasi transaksi bisnis.

---

## Panduan Troubleshooting

| Gejala Masalah | Langkah Pemeriksaan & Tindakan |
|---|---|
| **Jumlah antrean tidak sesuai** | Periksa vhost yang aktif, pastikan tidak ada consumer liar dari terminal lain |
| **Error `PRECONDITION_FAILED`** | Antrean pernah dibuat sebelumnya dengan argumen yang berbeda; gunakan vhost bersih |
| **Pesan tertahan di antrean retry** | Periksa konfigurasi message TTL dan target DLX binding |
| **Replay ditolak oleh helper** | Pastikan ID yang dimasukkan sesuai dengan ID yang tampil pada perintah `npm run routing -- peek` |

Rujukan teknis: [RabbitMQ Topics Tutorial](https://www.rabbitmq.com/tutorials/tutorial-five-javascript), [Alternate Exchanges](https://www.rabbitmq.com/docs/ae), [Time-To-Live (TTL)](https://www.rabbitmq.com/docs/ttl), dan [Dead Letter Exchanges](https://www.rabbitmq.com/docs/dlx).
