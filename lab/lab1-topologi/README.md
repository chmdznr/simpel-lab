# Lab 1 — Bedah Topologi RabbitMQ

**Hari 2 · Modul MP-04 (Sesi MP-04.2 & MP-04.3) · 2 Bagian Praktik @ 45 Menit.**

Seluruh latihan Lab 1 dilakukan melalui **RabbitMQ Management UI** untuk membedah mekanika perutean pesan sebelum kita menulis kode producer/consumer di MP-06.

> Panduan ini diverifikasi menggunakan RabbitMQ **4.3.5**. Jika menggunakan versi minor lain, tata letak menu pada dasarnya sama; catat versinya pada lembar laporan.

---

## Deliverable yang Dikumpulkan

1. **Diagram Arsitektur Komponen RabbitMQ** pada vhost masing-masing peserta: menampilkan producer, exchange (beserta tipenya), binding key/arguments, queue, dan consumer yang direncanakan. (Boleh digambar di kertas lalu difoto, atau menggunakan tools diagram seperti Excalidraw/draw.io).
2. **Tabel Hasil Observasi 8 Percobaan** (sesuai matriks di Bagian D).

---

## Persiapan Awal

1. Buka terminal di folder `simpel-lab/`, lalu nyalakan broker: `docker compose up -d rabbitmq`.
2. Periksa status: `docker compose ps rabbitmq` (pastikan berstatus **healthy**).
3. Buka browser ke `http://localhost:15672` dan login menggunakan akun admin lokal di `.env` (`simpel` / `simpel123`).
4. Siapkan kode peserta Anda, misalnya `p01`. Ganti contoh `p01` pada panduan ini dengan kode Anda sendiri. (Nama resource diawali `lab1.*` karena setiap peserta bekerja pada vhost terisolasi).

**Alokasi Waktu:**
- **Lab 1A (45 menit):** Setup akun & vhost (10 m) $\rightarrow$ Direct Exchange (12 m) $\rightarrow$ Fanout Exchange (12 m) $\rightarrow$ Review & pencatatan (11 m).
- **Lab 1B (45 menit):** Topic Exchange (12 m) $\rightarrow$ Headers Exchange (12 m) $\rightarrow$ Eksplorasi Quorum Queue (8 m) $\rightarrow$ Diagram & pembahasan (13 m).

---

## A. Pembuatan Vhost dan Akun Peserta (Setup Administrator)

1. **Buat Vhost**:
   - Buka menu **Admin → Virtual Hosts → Add a new virtual host**.
   - Isi nama vhost: `lab1-p01`, lalu klik **Add virtual host**.
   > *Catatan:* Nama vhost tidak perlu diawali tanda slash `/`. Di RabbitMQ, slash diperlakukan sebagai karakter nama biasa, bukan direktori hirarkis. Menghindari slash membuat format URL koneksi AMQP lebih bersih.
2. **Buat User Baru**:
   - Buka menu **Admin → Users → Add a user**.
   - Isi **Username**: `p01` dan tentukan password latihan sendiri.
   - Pada kolom **Tags**, pilih/isi `management`, lalu klik **Add user**. (Tag ini memberi hak akses login ke Management UI; hak akses vhost diatur terpisah pada langkah berikutnya).
3. **Konfigurasi Hak Akses (Permission)**:
   - Klik user `p01` yang baru dibuat.
   - Pada bagian **Set permission**, pilih vhost `lab1-p01`.
   - Isi ketiga kolom regex (**Configure**, **Write**, **Read**) dengan pola regex berjangkar (*anchored regex*):
     ```text
     ^lab1\..*
     ```
   - Klik **Set permission**. User ini sekarang berhak mengelola resource berawalan `lab1.` pada vhost miliknya, tanpa bisa melihat atau mengganggu vhost peserta lain.
4. **Verifikasi Login**:
   - Logout dari akun admin, lalu login sebagai `p01`.
   - Di pojok kanan atas, pastikan vhost aktif terpilih adalah `lab1-p01`.
   - Pastikan akun ini tidak memiliki tab Admin (karena bukan administrator).

---

## B. Direct dan Fanout Exchange — Lab 1A

### 1. Membuat Exchange dan Queue

1. **Buat Exchange**:
   - Buka menu **Exchanges → Add a new exchange**.
   - Buat `lab1.direct`: Type `direct`, Durability `Durable`, Auto delete `No`, Internal `No`, Arguments kosong.
   - Dengan langkah yang sama, buat `lab1.fanout`: Type `fanout`, parameter lainnya identik.
2. **Buat Queue**:
   - Buka menu **Queues and Streams → Add a new queue**.
   - Buat tiga queue dengan parameter **Type: Classic**, Durability `Durable`, Auto delete `No`, Arguments kosong:
     - `lab1.direct.validasi`
     - `lab1.fanout.validasi`
     - `lab1.fanout.tracking`
3. **Membuat Binding**:
   - Buka detail exchange `lab1.direct` $\rightarrow$ bagian **Bindings → Add binding from this exchange**.
   - Masukkan To queue: `lab1.direct.validasi`, Routing key: `pengajuan.siup.jakarta`, lalu klik **Bind**.
   - Buka detail exchange `lab1.fanout` $\rightarrow$ bind ke `lab1.fanout.validasi` (Routing key dikosongkan).
   - Masih di `lab1.fanout` $\rightarrow$ bind ke `lab1.fanout.tracking` (Routing key dikosongkan).

### 2. Prosedur Uji Coba Pengiriman Pesan

1. Tuliskan prediksi queue mana yang akan menerima pesan sebelum menekan tombol publish.
2. Buka detail exchange asal $\rightarrow$ bagian **Publish message**.
3. Masukkan **Routing key** sesuai tabel di Bagian D.
4. Pada bagian **Properties**, tambahkan properti dengan nama `delivery_mode` dan nilai `2` (*persistent*).
5. Masukkan payload JSON sederhana, misalnya: `{"case":"D1","pengajuanId":"SIM-001"}`.
6. Klik **Publish message**. Amati perubahan kolom **Ready** pada queue tujuan.
7. Buka queue tujuan $\rightarrow$ bagian **Get messages**, isi Messages `1`, Ack Mode pilih **Automatic ack**, lalu klik **Get Message(s)** untuk memeriksa isi pesan dan mengosongkan antrean lab.

---

## C. Topic, Headers, dan Quorum Queue — Lab 1B

1. Buat dua exchange baru:
   - `lab1.topic` (Type: `topic`, Durable)
   - `lab1.headers` (Type: `headers`, Durable)
2. Buat tiga queue bertipe **Classic Durable**:
   - `lab1.topic.jakarta`
   - `lab1.topic.siup`
   - `lab1.headers.jakarta`
3. Konfigurasi binding:
   - Bind `lab1.topic` $\rightarrow$ `lab1.topic.jakarta` dengan routing key: `pengajuan.*.jakarta`
   - Bind `lab1.topic` $\rightarrow$ `lab1.topic.siup` dengan routing key: `pengajuan.siup.#`
   - Bind `lab1.headers` $\rightarrow$ `lab1.headers.jakarta` dengan key kosong, lalu tambahkan tiga baris **Arguments** bertipe **String**:
     - `x-match` = `all`
     - `jenis` = `siup`
     - `kantor` = `jakarta`
4. Untuk kasus pengujian **H1** dan **H2**, saat melakukan publish di exchange `lab1.headers`, masukkan atribut di bagian **Headers** form:
   - Kasus H1: `jenis` = `siup`, `kantor` = `jakarta` (keduanya bertipe String).
   - Kasus H2: `jenis` = `siup`, `kantor` = `bandung` (keduanya bertipe String).
   - Routing key dapat diisi kata bebas (misalnya `diabaikan`) karena headers exchange tidak mengevaluasi routing key.
5. **Eksplorasi Quorum Queue**:
   - Buat queue baru bernama `lab1.quorum`, pilih Type **Quorum**, Durable. (Jangan pasang binding untuk queue ini).
   - Bandingkan label dan metadata quorum queue dengan classic queue. Pada broker standalone satu node, quorum queue hanya memiliki 1 replica/member Raft sehingga belum memiliki toleransi fault-tolerance cluster.

---

## D. Matriks Percobaan dan Observasi

Setiap baris menguji publikasi **satu pesan**. Tuliskan prediksi Anda terlebih dahulu sebelum mempublish:

| Kasus | Exchange | Routing Key / Header | Prediksi Queue Tujuan | Hasil Observasi Nyata |
|---|---|---|---|---|
| **D1** | `lab1.direct` | `pengajuan.siup.jakarta` | `lab1.direct.validasi` | |
| **D2** | `lab1.direct` | `pengajuan.siup.bandung` | *(tidak ada / unroutable)* | |
| **F1** | `lab1.fanout` | *(bebas / diabaikan)* | `lab1.fanout.validasi`, `lab1.fanout.tracking` | |
| **T1** | `lab1.topic` | `pengajuan.siup.jakarta` | `lab1.topic.jakarta`, `lab1.topic.siup` | |
| **T2** | `lab1.topic` | `pengajuan.nib.jakarta` | `lab1.topic.jakarta` | |
| **T3** | `lab1.topic` | `pengajuan.siup.jakarta.revisi` | `lab1.topic.siup` | |
| **H1** | `lab1.headers` | `jenis=siup`, `kantor=jakarta` | `lab1.headers.jakarta` | |
| **H2** | `lab1.headers` | `jenis=siup`, `kantor=bandung` | *(tidak ada / unroutable)* | |

### Pertanyaan Analisis Teknis

1. **Mengapa kasus T3 tidak masuk ke `lab1.topic.jakarta`?**
   *Penjelasan:* Pola `pengajuan.*.jakarta` menggunakan wildcard star (`*`) yang mencocokkan **tepat satu kata/segmen**. Routing key `pengajuan.siup.jakarta.revisi` memiliki 4 segmen dan berakhiran `.revisi`, sehingga tidak cocok dengan pola yang berakhiran `.jakarta`. Sebaliknya, pola `pengajuan.siup.#` menggunakan wildcard hash (`#`) yang mencocokkan nol atau banyak segmen kata berikutnya.
2. **Apa perbedaan mendasar antara satu pesan yang digandakan ke dua queue (Pub-Sub) vs dua worker yang membaca satu queue yang sama (Competing Consumers)?**
3. **Pada kasus D2, mengapa tidak adanya queue tujuan tidak menghasilkan pesan error ke publisher secara default?** (Konsep pesan unroutable dan parameter *mandatory*).

---

## E. Checklist Verifikasi Mandiri

- [ ] User peserta berhasil login dan hanya memiliki hak akses pada vhost `lab1-p01`.
- [ ] Empat exchange (`direct`, `fanout`, `topic`, `headers`) berhasil dideklarasikan.
- [ ] Enam Classic Queue dan satu Quorum Queue terdaftar pada vhost.
- [ ] Seluruh 8 skenario pengujian cocok dengan prediksi matriks perutean.
- [ ] Diagram topologi mencantumkan relasi exchange, binding key/arguments, queue, dan peran consumer.

---

## Skrip Verifikasi Otomatis Instruktur

Tersedia skrip pengujian otomatis via HTTP API untuk memvalidasi konfigurasi lab peserta secara cepat:

```bash
RABBITMQ_MANAGEMENT_URL=http://localhost:15672 node --env-file=.env tools/verify-lab1.mjs
```

Rujukan teknis: [Dokumentasi AMQP Concepts RabbitMQ](https://www.rabbitmq.com/tutorials/amqp-concepts) dan [RabbitMQ Access Control](https://www.rabbitmq.com/docs/access-control).
