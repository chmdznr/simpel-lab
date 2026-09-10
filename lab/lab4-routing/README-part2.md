# Lab 4B — Topic routing, retry, dan DLQ

**Kamis 17 September 2026, 08.00–09.30, 2 JP praktik.** Lanjutan Lab 4A. Semua data SIMPEL fiktif. Jalankan dari root simpel-lab dengan Node 20.6+ dan stack lokal aktif. Topologi memakai awalan lab4b sehingga tidak mengubah antrean hari ketiga.

## Blok 7.3 — Routing berbasis jenis dan kantor (45 menit)

1. Menit 0–5: periksa `docker compose ps`, `node --version`, dan koneksi broker melalui `npm run routing -- setup`. Gunakan vhost masing-masing jika memakai broker kelas.
2. Menit 5–12: tulis prediksi sebelum mengirim. Binding Jakarta adalah `pengajuan.*.jakarta`, binding SIUP adalah `pengajuan.siup.*`. Bintang menggantikan tepat satu kata. Tanda pagar menggantikan nol atau lebih kata.
3. Menit 12–27: jalankan tiga perintah berikut. Catat messageId setiap publikasi.

```sh
npm run routing -- publish pengajuan.siup.jakarta
npm run routing -- publish pengajuan.nib.bandung
npm run routing -- publish pengajuan.siup.bandung
npm run routing -- inspect
```

| Routing key | Jakarta | SIUP | Cadangan |
|---|---:|---:|---:|
| pengajuan.siup.jakarta | 1 | 1 | 0 |
| pengajuan.nib.bandung | 0 | 0 | 1 |
| pengajuan.siup.bandung | 0 | 1 | 0 |
| **Pertambahan jumlah ready** | **1** | **2** | **1** |

4. Menit 27–37: cocokkan pertambahan ready, bukan angka absolut jika antrean sudah berisi data. Periksa bindings di RabbitMQ Management. Bukalah kode `tools/routing.js`, fungsi declare. Hubungkan setiap binding dengan satu sel tabel.
5. Menit 37–45: ubah prediksi untuk `pengajuan.*.*` versus `pengajuan.#`. Yang pertama memerlukan tepat tiga kata. Yang kedua menerima pengajuan dan semua turunannya. Jelaskan mengapa satu pesan dapat memperoleh dua salinan di dua antrean.

**Bukti kelulusan 7.3:** tabel prediksi dan hasil, tiga messageId, serta tangkapan bindings. Rute cadangan ialah alternate exchange lab4b.unmatched bertipe fanout. Jika pesan sampai ke antrean cadangan, mandatory tidak mengembalikannya ke publisher. Confirm menunjukkan penerimaan broker, bukan keberhasilan proses bisnis.

## Blok 7.4 — Retry berjeda dan replay setelah perbaikan (45 menit)

1. Menit 0–6: buka terminal A dan jalankan worker:

```sh
npm run routing -- worker
```

2. Menit 6–14: terminal B mengirim simulasi gagal dua kali. Angka 2 adalah failUntil, bukan jumlah salinan pesan.

```sh
npm run routing -- job 2
```

Worker mencatat attempt 1 retry, attempt 2 retry, attempt 3 processed. Setiap antrean retry memiliki message TTL 2.000 ms dan DLX menuju antrean kerja. Tidak ada consumer pada antrean retry. TTL bukan janji waktu penjadwalan yang tepat.

3. Menit 14–24: jalankan `npm run routing -- job 99`. Simulasi gagal terus, tetapi kode berhenti menjadwalkan retry pada attempt 3. Hasil terakhir terminal. Tidak ada jalur otomatis dari DLQ kembali ke antrean kerja.

```sh
npm run routing -- inspect
npm run routing -- peek
```

Peek memakai manual acknowledgement dan mengembalikan pesan ke antrean. Ia tidak menghapus pesan. Salin messageId di kepala DLQ. Jangan mengarang ID baru.

4. Menit 24–36: hentikan worker terminal A dengan Ctrl+C. Dalam latihan ini, perbaikan dependency disimulasikan dengan variabel LAB4_REPAIRED. Jalankan worker yang sudah diperbaiki, lalu replay satu pesan yang telah diperiksa.

```sh
# Terminal A
LAB4_REPAIRED=1 npm run routing -- worker
# Terminal B: ganti nilai ini dengan ID dari peek
LAB4_REPAIRED=1 npm run routing -- replay evt-ID-DARI-PEEK
```

Replay hanya menerima ID pesan di kepala DLQ. Pesan sumber diakui setelah publikasi ulang mendapat confirm. ID tetap sama, attempt untuk siklus pemulihan ini kembali 1. Pastikan processed muncul dan DLQ berkurang satu. Jika dependency sebenarnya belum diperbaiki, jangan replay.

5. Menit 36–45: jelaskan tiga celah kegagalan: proses mati sebelum publish, setelah publish tetapi sebelum ack, serta target DLX tidak tersedia. Tambahkan keputusan apakah replay perlu persetujuan pemilik proses bisnis.

**Bukti kelulusan 7.4:** log tiga attempt, jeda pengiriman ulang, isi DLQ, dan ID yang sama sebelum/sesudah replay. Dalam eksekusi tanpa crash ada maksimum tiga percobaan terjadwal. Redelivery karena koneksi putus dapat menambah pemanggilan handler dengan attempt yang sama. Efek nyata tetap memerlukan idempotensi seperti Lab 5.

## Troubleshooting dan batas

| Gejala | Pemeriksaan berikutnya |
|---|---|
| Queue count tidak sesuai | Bandingkan delta, vhost, bindings, dan ada/tidaknya consumer lain |
| PRECONDITION_FAILED | Nama/topologi pernah dibuat dengan argumen berbeda; gunakan vhost lab bersih setelah menyimpan bukti |
| Pesan tetap di retry | Periksa TTL, target DLX, dan binding work |
| Worker berhenti | Periksa kontrak pesan dan broker; sumber yang belum di-ack dikembalikan ketika channel tutup |
| Replay ditolak | Cocokkan kepala DLQ, messageId, dan variabel perbaikan |

Tidak ada penghapusan massal atau reset volume dalam panduan ini. Default classic-queue dead-lettering tidak menjamin pemindahan tanpa kehilangan ketika target tidak tersedia. Untuk kebutuhan produksi, evaluasi quorum queue dengan at-least-once dead-lettering atau mekanisme relay terkonfirmasi. Lab 5 menggunakan outbox DB untuk retry tertunda agar keputusan retry dan pemindahan pekerjaan dapat dicatat secara atomik.

**Rujukan:** [Topics](https://www.rabbitmq.com/tutorials/tutorial-five-javascript), [Alternate exchanges](https://www.rabbitmq.com/docs/ae), [TTL](https://www.rabbitmq.com/docs/ttl), [DLX safety](https://www.rabbitmq.com/docs/dlx).
