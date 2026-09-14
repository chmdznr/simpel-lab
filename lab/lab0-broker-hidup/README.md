# Lab 0 — Verifikasi Broker Hidup

**Sesi:** MP-03.3 (13.00–15.15, Hari 1) · **Durasi:** 45 menit · **Tanpa kode program.**

Tujuan lab ini sangat jelas: **memastikan setiap peserta memiliki instance RabbitMQ yang benar-benar aktif dan sehat di laptop masing-masing**, serta memahami secara langsung wujud queue, exchange, dan pesan melalui RabbitMQ Management UI sebelum kita menulis kode Node.js di modul-modul berikutnya. Sesi ini adalah fondasi awal untuk seluruh rangkaian 27 JP praktik ke depan.

Jika di langkah mana pun Anda mengalami kendala teknis, **segera beri tahu instruktur di chat atau gunakan fitur raise hand** — jangan mencoba mengotak-atik sendiri lebih dari 2 menit agar waktu praktik tidak habis.

---

## Langkah 1 — Jalankan Container Broker

Buka terminal di root direktori `simpel-lab/`, lalu jalankan:

```bash
docker compose up -d rabbitmq postgres
```

Tunggu beberapa saat hingga container berstatus sehat:

```bash
docker compose ps
```

Pastikan container `simpel-rabbitmq` menampilkan status `Up ... (healthy)`. Jika status masih `starting`, tunggu sekitar 15–30 detik lalu ulangi pengecekan status.

> **Jika container gagal menyala** (misalnya port bentrok atau Docker Desktop belum berjalan), silakan periksa panduan *Troubleshooting* di [`../../PANDUAN-SETUP.md`](../../PANDUAN-SETUP.md). Jangan melanjutkan ke Langkah 2 sebelum status container dipastikan `healthy`.

---

## Langkah 2 — Buka RabbitMQ Management UI

Buka web browser dan akses:

```text
http://localhost:15672
```

Login menggunakan kredensial default dari file `.env`:

- **Username:** `simpel`
- **Password:** `simpel123`

Setelah login berhasil, Anda akan diarahkan ke halaman dashboard dengan tab navigasi: **Overview, Connections, Channels, Exchanges, Queues and Streams, Admin**.

---

## Langkah 3 — Buat Queue Pertama

1. Klik tab **Queues and Streams**.
2. Klik menu **Add a new queue**.
3. Isi parameter antrean sebagai berikut:
   - **Name:** `lab0.<nama-anda>` — contoh: `lab0.budi` (gunakan nama panggilan Anda sendiri agar unik).
   - **Type:** `Classic`
   - **Durability:** `Durable`
4. Klik tombol **Add queue**.

Anda akan diarahkan kembali ke daftar antrean dan melihat queue baru Anda dengan metrik: **Ready: 0, Unacked: 0, Total: 0**.

---

## Langkah 4 — Kirim Pesan Pertama via Management UI

1. Klik nama queue Anda (`lab0.<nama-anda>`) untuk membuka halaman rincian antrean.
2. Gulir ke bagian **Publish message**.
3. Pada kolom **Payload**, ketik pesan teks bebas, misalnya:
   ```text
   Pengajuan SIUP dari Budi, kantor Jakarta
   ```
4. Biarkan field lainnya apa adanya (properti Delivery mode `2 - Persistent` sudah menjadi default di RabbitMQ 4.x pada form UI ini).
5. Klik tombol **Publish message**.

Perhatikan bahwa angka **Ready** akan bertambah menjadi `1`. Pesan Anda sekarang **aman tersimpan di storage broker**, menunggu untuk dikonsumsi oleh worker — ini adalah implementasi nyata dari konsep *store-and-forward* yang dibahas pada teori MP-03. Meskipun browser ditutup atau container sempat di-restart, pesan persistent ini tidak akan hilang.

---

## Langkah 5 — Mengambil Pesan Kembali (Polling)

1. Masih di halaman rincian queue yang sama, gulir ke bagian **Get messages**.
2. Atur **Messages** ke `1`, dan ubah **Ack Mode** ke `Nack message requeue true` (agar pesan dikembalikan ke queue setelah dibaca untuk kebutuhan eksperimen).
3. Klik tombol **Get Message(s)**.

Payload pesan yang Anda kirim akan muncul di layar beserta metadata properti seperti `delivery_mode`, `routing_key`, dan flag `redelivered`. Nilai **Ready** tetap `1` karena kita memilih opsi requeue.

> **Catatan:** Jika Anda memilih **Ack Mode = "Automatic ack"**, pesan tersebut akan langsung dihapus permanen dari antrean begitu ditarik oleh browser. Karakteristik ini akan dibahas tuntas di MP-03.2 dan MP-06 (*at-least-once delivery* vs *auto-ack*).

---

## Langkah 6 — Mengenal Default Exchange

1. Klik tab **Exchanges**.
2. Perhatikan baris teratas dengan nama kosong (`(AMQP default)`) bertipe `direct`.

Ini adalah **Default Exchange** bawaan RabbitMQ. Exchange ini secara otomatis mengikat (*binding*) setiap queue baru ke dirinya sendiri dengan **routing key yang sama persis dengan nama queue**.

Itulah sebabnya fitur *Publish message* di Langkah 4 tadi berhasil mengirim pesan ke queue meskipun Anda belum pernah membuat binding manual: secara internal, form UI tersebut mempublish pesan ke default exchange menggunakan routing key nama queue Anda.

Exchange bawaan lainnya seperti `amq.direct`, `amq.fanout`, dan `amq.topic` adalah template standar AMQP yang akan kita eksplorasi lebih mendalam di Lab 1 (MP-04).

---

## Langkah 7 — Mengamati Laju Pesan (Message Rates)

1. Kembali ke tab navigasi **Overview**.
2. Perhatikan grafik **Message rates** di bagian atas dashboard.
3. Lakukan kembali Langkah 4 (publish) dan Langkah 5 (get) beberapa kali berturut-turut sambil mengamati grafik tersebut.

Anda akan melihat kurva metrik **publish** dan **deliver / get** bergerak naik secara real-time. Grafik ini adalah metrik penting yang nanti akan kita pantau saat mengamati beban antrean dan mendiagnosis bottleneck di Lab 6 (Monitoring) dan Lab 7 (Troubleshooting).

---

## Checklist Verifikasi Mandiri

Sebelum mengakhiri sesi Lab 0, pastikan seluruh kriteria berikut terpenuhi:

- [ ] Perintah `docker compose ps` menampilkan container `simpel-rabbitmq` berstatus `healthy`.
- [ ] Berhasil login ke RabbitMQ Management UI di `http://localhost:15672`.
- [ ] Berhasil membuat queue baru `lab0.<nama-anda>` dengan tipe `Classic Durable`.
- [ ] Berhasil mempublish dan membaca ulang (*get*) pesan contoh melalui Management UI.
- [ ] Memahami posisi dan mekanisme kerja `(AMQP default)` exchange.
- [ ] Mengamati perubahan grafik throughput di tab Overview saat pesan mengalir.

Jika seluruh poin checklist telah tercentang, environment broker Anda telah siap digunakan untuk modul Lab 1 (MP-04) dan Lab 3 (MP-06) yang mulai melibatkan kode aplikasi.

---

## Eskalasi Kendala Lingkungan

Jika broker lokal di laptop Anda belum berhasil menyala, segera laporkan ke tim instruktur atau asisten di kanal kelas agar dapat dibantu penanganannya di breakout room. Pastikan lingkungan broker sudah siap 100% sebelum memasuki sesi hari kedua.
