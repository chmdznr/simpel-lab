# Lab 0 — Broker Hidup

**Sesi:** MP-3.3 (13.00–15.15, Hari 1) · **Durasi:** 45 menit · **Tanpa kode.**

Tujuan lab ini cuma satu: **memastikan semua orang punya RabbitMQ yang benar-benar hidup**, dan melihat sendiri bentuk queue, exchange, serta pesan lewat Management UI — sebelum menyentuh satu baris kode Node.js pun. Ini gerbang seluruh 27 JP praktik yang tersisa, jadi jangan buru-buru.

Kalau di langkah mana pun Anda macet, **angkat tangan** — jangan mencoba memperbaiki sendiri lebih dari 2 menit. Ada broker cadangan kalau laptop Anda benar-benar tidak bisa dipakai (lihat bagian paling bawah).

---

## Langkah 1 — Nyalakan broker

Dari folder `simpel-lab/` (harusnya sudah `docker compose up -d rabbitmq postgres` sejak H-1 sesuai PANDUAN-SETUP.md, tapi ulangi saja untuk memastikan):

```bash
docker compose up -d rabbitmq postgres
```

Tunggu sampai statusnya sehat:

```bash
docker compose ps
```

Anda harus melihat `simpel-rabbitmq` dengan status `Up ... (healthy)`. Kalau masih `starting`, tunggu 15–30 detik lagi lalu ulangi perintah di atas.

**Kalau gagal di sini** — port bentrok, Docker Desktop belum jalan, dll — lihat bagian *Troubleshooting* di `../../PANDUAN-SETUP.md`. Jangan lanjut ke Langkah 2 sebelum statusnya `healthy`.

---

## Langkah 2 — Buka Management UI

Buka browser ke:

```
http://localhost:15672
```

Login dengan (dari file `.env` Anda, nilai bawaan):

- **Username:** `simpel`
- **Password:** `simpel123`

Anda akan melihat dashboard dengan tab **Overview, Connections, Channels, Exchanges, Queues, Admin** di bagian atas.

> Kalau memakai broker cadangan (lihat bagian bawah halaman ini), alamat dan kredensialnya berbeda — pakai yang dibagikan panitia, bukan yang di atas.

---

## Langkah 3 — Buat queue pertama Anda

1. Klik tab **Queues and Streams**.
2. Klik **Add a new queue**.
3. Isi:
   - **Name:** `lab0.<nama-anda>` — misalnya `lab0.budi` (pakai nama Anda sendiri supaya tidak tabrakan dengan peserta lain, karena kita berbagi satu broker demo).
   - **Type:** `Classic`
   - **Durability:** `Durable`
4. Klik **Add queue**.

Anda akan diarahkan ke daftar queue dan melihat queue baru Anda dengan **Ready: 0, Unacked: 0, Total: 0**.

---

## Langkah 4 — Kirim pesan pertama lewat UI

1. Klik nama queue Anda (`lab0.<nama-anda>`) untuk membuka detailnya.
2. Gulir ke bagian **Publish message**.
3. Di kolom **Payload**, ketik pesan bebas, misalnya:
   ```
   Pengajuan SIUP dari Budi, kantor Jakarta
   ```
4. Biarkan field lain apa adanya (Delivery mode `2 - Persistent` sudah default di RabbitMQ 4.x untuk publish lewat UI ini).
5. Klik **Publish message**.

Perhatikan **Ready** naik jadi `1`. Pesan Anda sekarang **tersimpan di disk broker**, menunggu diambil siapa pun yang mengonsumsinya — persis konsep *store-and-forward* yang baru dibahas di sesi 3.1. Matikan browser, matikan laptop sekalipun (broker tetap jalan di Docker) — pesan itu tidak hilang.

---

## Langkah 5 — Ambil pesan itu kembali

1. Masih di halaman queue yang sama, gulir ke bagian **Get messages**.
2. Set **Messages** ke `1`, **Ack Mode** ke `Nack message requeue true` (supaya pesan kembali ke queue setelah dilihat — jangan sampai hilang untuk latihan berikutnya).
3. Klik **Get Message(s)**.

Anda akan melihat payload pesan yang tadi Anda kirim muncul di layar, lengkap dengan properti seperti `delivery_mode`, `routing_key`, dan `redelivered`. **Ready** kembali ke `1` karena kita memilih requeue.

> Kalau Anda pilih **Ack Mode = "Automatic ack"**, pesan itu langsung hilang dari queue begitu diambil — itu normal, bukan bug. Baru dibahas tuntas di MP-3.2 (at-least-once vs auto-ack).

---

## Langkah 6 — Kenali exchange default

1. Klik tab **Exchanges**.
2. Cari baris dengan nama **kosong** (`(AMQP default)`) di kolom Name.

Ini **default exchange** — jenis `direct` bawaan RabbitMQ yang otomatis mem-binding setiap queue ke dirinya sendiri memakai *nama queue sebagai routing key*. Inilah sebabnya `Publish message` di Langkah 4 tadi berhasil sampai walau Anda tidak pernah membuat binding manual: Anda menerbitkan lewat halaman queue, yang di baliknya memakai default exchange dengan routing key = nama queue itu sendiri.

Exchange lain seperti `amq.direct`, `amq.fanout`, `amq.topic` yang sudah ada di daftar adalah bawaan RabbitMQ — belum kita pakai, baru di Lab 1 (MP-4).

---

## Langkah 7 — Amati laju pesan (message rate)

1. Kembali ke tab **Overview**.
2. Lihat grafik **Message rates** di bagian atas.
3. Ulangi Langkah 4 (publish) dan Langkah 5 (get) beberapa kali berturut-turut, sambil memperhatikan grafik ini.

Anda akan melihat garis **publish** dan **deliver / get** naik setiap kali Anda melakukan aksi tersebut. Grafik yang sama persis inilah yang nanti dipakai instruktur untuk mendiagnosis "pesan menumpuk karena konsumen mati/lambat" di MP-10 (Troubleshooting).

---

## Selesai — daftar tilik

Sebelum lanjut ke sesi berikutnya, pastikan Anda bisa menjawab **ya** untuk semua ini:

- [ ] `docker compose ps` menunjukkan `simpel-rabbitmq` berstatus `healthy`.
- [ ] Saya berhasil login ke Management UI (`http://localhost:15672`).
- [ ] Saya berhasil membuat queue `lab0.<nama-anda>`.
- [ ] Saya berhasil mengirim (publish) dan mengambil (get) satu pesan lewat UI.
- [ ] Saya bisa menunjuk exchange default (`(AMQP default)`) di tab Exchanges.
- [ ] Saya melihat grafik message rate bergerak saat saya publish/get.

Kalau semua tercentang — broker Anda hidup dan siap untuk Lab 1 (MP-4, Hari 2) dan Lab 3 (MP-6, Hari 3) yang sudah memakai kode Node.js.

---

## Kalau broker lokal Anda tidak bisa dipakai

Ikuti bagian **"Broker cadangan terpusat"** di `../../PANDUAN-SETUP.md`. Ganti alamat Management UI dan kredensial di atas dengan yang dibagikan panitia — langkah 3 sampai 7 di halaman ini tetap sama persis, hanya nama queue Anda yang wajib mengandung nama sendiri (`lab0.<nama-anda>`) supaya tidak bentrok dengan peserta lain yang berbagi broker yang sama.
