# Lab 2 — Desain integrasi SIMPEL

**MP-05 · Hari 2 · 45 menit · kelompok 3–4 orang.** Tidak membutuhkan Docker
atau coding. Gunakan [lembar kerja satu halaman](lembar-kerja.pdf) untuk cetak,
atau salin [versi Markdown](lembar-kerja.md) ke dokumen kelompok.

## Kasus dan batas rancangan

SIMPEL adalah sistem perizinan **fiktif**. Gateway menerima pengajuan;
validasi memeriksa dokumen; billing menerbitkan kode; notifikasi memberi kabar;
tracking menyajikan status. Dalam versi sinkron, gangguan billing dan notifikasi
lambat memperpanjang waktu tunggu pengguna. Rancang jalur asinkron yang tetap
menjaga keterlacakan pekerjaan.

Tetapkan apa arti “diterima” dan “selesai”. Respons HTTP `202` tidak berarti
validasi lolos atau billing sudah terbit. Penerimaan harus didukung penyimpanan
yang sesuai rancangan; respons cepat saja tidak cukup. Untuk kontrak latihan,
gunakan HTTP `202` berisi `pengajuanId` dan URL status setelah penerimaan durable.
Jangan menjadikan angka target latihan sebagai SLA resmi atau hasil benchmark.

Pakai nama layanan di atas. Nama domain event yang dipakai bersama:

| Producer | Event | Makna |
|---|---|---|
| gateway | `pengajuan.diterima` | Pengajuan tersimpan dan diterima untuk diproses |
| validasi | `pengajuan.valid` | Pemeriksaan berhasil |
| validasi | `pengajuan.ditolak` | Pemeriksaan menghasilkan penolakan bisnis |
| billing | `billing.terbit` | Kode billing tersimpan |

Event baru hanya ditambahkan jika ada kebutuhan dan pemiliknya jelas. Pilih
exchange dan queue sendiri; gunakan salah satu dari empat tipe yang telah
dipelajari. Nama resource SIMPEL tidak harus menyalin prefix `lab1.`.
Desain ini belum mengubah skeleton layanan; implementasinya dimulai MP-06.

## Langkah dan waktu

| Menit | Tugas | Bukti yang harus tampak |
|---|---|---|
| 0–5 | Bagi peran: fasilitator, pencatat, penantang, penyaji | Nama kelompok; batas proses dan kebutuhan |
| 5–15 | Gambar alur sukses, status, dan pemilik data | Gateway, exchange, queue, consumer; balasan HTTP terpisah |
| 15–25 | Isi routing dan kontrak satu event | Event → exchange/type → key → queue → consumer; JSON minimum |
| 25–35 | Uji tiga kartu gangguan di bawah | Tindakan, status pengguna, pemilik pemulihan, bukti selesai |
| 35–42 | Tukar rancangan dengan kelompok lain | Satu celah ditemukan; satu keputusan diperbaiki |
| 42–45 | Kumpulkan dan simpulkan | Satu halaman, satu alasan pemilihan broker, satu risiko tersisa |

## Kontrak pesan minimum

Cantumkan `event`, `schemaVersion`, `messageId`, `correlationId`, `occurredAt`
(UTC ISO 8601), dan `data.pengajuanId`. Tambahkan hanya data yang diperlukan
consumer. Bedakan payload dari properti AMQP: identitas payload `messageId`
dapat dipetakan ke `message_id`, dan `correlationId` ke `correlation_id`.
Tentukan siapa membuat ID, apa yang tetap saat retry, dan bagaimana consumer
menangani versi skema yang tidak didukung. Jangan memasukkan berkas dokumen,
credential, atau data pribadi nyata ke contoh.

## Kartu gangguan

1. **Billing tidak tersedia 10 menit.** Apa yang tetap diterima? Di mana pekerjaan
   menunggu? Berapa retry dan jedanya? Kapan eskalasi? Status apa yang terlihat?
2. **Notifikasi memerlukan 3 detik per pesan.** Mengapa validasi/billing tidak ikut
   menunggu? Apakah perlu queue sendiri atau cukup worker tambahan? Bagaimana
   membedakan billing selesai dari notifikasi belum terkirim?
3. **Event yang sama terkirim dua kali.** Consumer crash setelah commit DB tetapi
   sebelum ack. Apa kunci deduplikasi? Bagaimana mencegah dua kode billing?
   Mengapa memeriksa flag `redelivered` saja tidak cukup?

Tuliskan juga penanganan payload rusak: jangan retry tanpa batas. DLQ harus
memiliki pemilik pemeriksaan dan prosedur redrive setelah penyebab diperbaiki.
Mekanisme retry/DLQ akan dibangun pada MP-07; saat ini cukup rancangan eksplisit.

## Tinjauan sejawat dan penilaian

Nilai tiap aspek 0 = tidak ada, 1 = ada tetapi belum konsisten, 2 = konsisten
dan bisa diuji. Total maksimum 10; gunakan untuk umpan balik, bukan nilai resmi.

| Aspek | Pertanyaan tinjauan |
|---|---|
| Kebutuhan/status | Apakah diterima, selesai, ditolak, dan tertunda dibedakan? |
| Topologi | Apakah setiap event mencapai consumer yang tepat tanpa dua layanan berebut satu queue? |
| Kontrak | Apakah identitas, versi, waktu, data minimum, dan pemilik event jelas? |
| Kegagalan | Apakah retry terbatas, idempotensi, DLQ, dan pemilik pemulihan menjawab tiga kartu? |
| Pembuktian | Apakah ada langkah dan hasil yang diharapkan untuk alur sukses serta gangguan? |

Simpan sebagai `lab2-<kelompok>.pdf` atau `.md`, beserta diagram jika terpisah.
Gunakan kembali pada MP-06–08 dan action learning/capstone. Contoh pengajar
dibahas setelah pertukaran rancangan, bukan sebagai template untuk disalin.
