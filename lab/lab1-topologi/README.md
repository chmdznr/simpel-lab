# Lab 1 — Bedah Topologi RabbitMQ

**Hari 2, MP-04.2 dan MP-04.3. Dua bagian praktik, masing-masing 45 menit.**
Gunakan Management UI. Kode producer/consumer mulai dikerjakan pada MP-06.
Label UI di bawah diperiksa pada RabbitMQ **4.3.5**. Pada versi lain, cari
bagian yang memiliki fungsi sama dan catat versinya pada hasil pengamatan.

## Hasil yang dikumpulkan

Satu diagram komponen RabbitMQ dalam vhost peserta dan tabel hasil delapan
percobaan pada bagian D. Diagram harus menampilkan producer, exchange,
binding, queue, consumer, nama resource, tipe exchange, serta routing key atau
header. Gambar di kertas lalu foto, atau gunakan aplikasi diagram pilihan kelas.

## Persiapan

1. Dari folder `simpel-lab`, jalankan `docker compose up -d rabbitmq`.
2. Jalankan `docker compose ps rabbitmq`. Tunggu status **healthy**.
3. Buka `http://localhost:15672` dan masuk menggunakan akun lokal pada `.env`.
4. Gunakan kode peserta, misalnya `p01`. Ganti contoh `p01` di seluruh panduan
   dengan kode sendiri. Nama resource `lab1.*` tetap sama karena vhost terpisah.
5. Peserta yang memakai broker cadangan menggunakan alamat UI, vhost, dan akun
   yang dibagikan instruktur. Instruktur mengerjakan langkah administrasi pada
   bagian A. Peserta menerima akses hanya ke vhost masing-masing.

Alokasi Lab 1A: akses 10 menit, direct 12 menit, fanout 12 menit, pencatatan
dan bantuan 11 menit. Lab 1B: topic 12 menit, headers 12 menit, tipe queue
8 menit, diagram dan pembahasan 13 menit. Minta bantuan di kanal kelas setelah
dua menit tanpa kemajuan.

## A. Vhost dan akun peserta — administrator lokal/instruktur

1. Buka **Admin → Virtual Hosts → Add a new virtual host**. Isi nama
   `lab1-p01`, lalu **Add virtual host**. Vhost ini terpisah dari vhost Lab 0.
2. Buka **Admin → Users → Add a user**. Isi username `p01` dan password
   latihan yang dipilih sendiri. Jangan gunakan password akun kantor.
3. Pada **Tags**, pilih/isi `management`, lalu **Add user**. Tag ini memberi
   akses Management UI. Permission vhost tetap perlu diberikan secara terpisah.
4. Klik user `p01`. Di bagian **Set permission**, pilih vhost `lab1-p01`.
   Isi ketiga kolom **Configure**, **Write**, dan **Read** dengan pola yang sama:

   ```text
   ^lab1\..*
   ```

5. Klik **Set permission**. Akun ini dapat mengelola resource berawalan
   `lab1.` pada vhost tersebut. Jangan memberi permission ke vhost peserta lain.
6. Logout, lalu login sebagai `p01`. Pilih vhost `lab1-p01` jika ada pemilih
   vhost di kanan atas. Pastikan akun ini tidak memiliki fasilitas administrator.

Nama vhost tidak perlu diawali `/`. Slash merupakan karakter nama, bukan
syarat vhost. Penggunaan nama tanpa slash memudahkan penulisan URL nanti.

## B. Direct dan fanout — Lab 1A

### Membuat exchange dan queue

1. Buka **Exchanges → Add a new exchange**. Buat `lab1.direct`, Type `direct`,
   Durability `Durable`, Auto delete `No`, Internal `No`, Arguments kosong.
2. Dengan langkah yang sama, buat `lab1.fanout`, Type `fanout`.
3. Buka **Queues and Streams → Add a new queue**. Buat tiga queue di bawah.
   Pilih **Type: Classic**, Durability `Durable`, Auto delete `No`, Arguments
   kosong untuk masing-masing queue. Pilih tipenya secara eksplisit.

   | Queue | Exchange asal | Binding key |
   |---|---|---|
   | `lab1.direct.validasi` | `lab1.direct` | `pengajuan.siup.jakarta` |
   | `lab1.fanout.validasi` | `lab1.fanout` | kosong |
   | `lab1.fanout.tracking` | `lab1.fanout` | kosong |

4. Buka detail exchange. Pada **Bindings → Add binding from this exchange**,
   pilih destination type **Queue**, isi **To queue** sesuai tabel, isi
   **Routing key**, lalu **Bind**. Ulangi sampai ketiga binding terpasang.
5. Periksa daftar binding. Queue yang dibuat tanpa binding belum menerima
   pesan dari exchange latihan tersebut.

### Cara menjalankan setiap percobaan

1. Tulis dulu queue mana yang diperkirakan menerima pesan.
2. Buka detail **exchange** asal, lalu **Publish message**. Isi routing key
   sesuai tabel D. Pada **Properties**, isi nama `delivery_mode` dan nilai `2`
   (persistent). RabbitMQ 4.3.5 memakai pasangan nama/nilai, bukan dropdown.
3. Isi payload sederhana, misalnya `{"case":"D1","pengajuanId":"SIM-001"}`.
   Ganti `case` untuk setiap percobaan. Tambahkan Headers hanya untuk H1/H2.
4. Klik **Publish message**. Amati hasil routing dan jumlah **Ready** pada
   queue yang diperkirakan menerima. Angka UI diperbarui berkala; refresh bila perlu.
5. Buka queue tujuan → **Get messages**, Messages `1`, Ack Mode
   **Automatic ack**, lalu **Get Message(s)**. Mode ini tidak mengembalikan
   pesan ke antrean. Periksa `case` pada payload. Ulangi sampai queue kosong.
   Ini hanya inspeksi lab; aplikasi bisnis memakai strategi acknowledgment sendiri.
6. Queue yang tidak seharusnya menerima pesan harus tetap kosong. Selesaikan
   inspeksi dan kosongkan pesan percobaan sebelum berpindah kasus agar hasil jelas.

## C. Topic, headers, dan tipe queue — Lab 1B

1. Buat `lab1.topic` dengan Type `topic` dan `lab1.headers` dengan Type `headers`.
   Gunakan atribut Durable/Auto delete/Internal yang sama dengan bagian B.
2. Buat tiga queue **Classic Durable** dan binding berikut:

   | Queue | Exchange | Binding key / arguments |
   |---|---|---|
   | `lab1.topic.jakarta` | `lab1.topic` | key `pengajuan.*.jakarta` |
   | `lab1.topic.siup` | `lab1.topic` | key `pengajuan.siup.#` |
   | `lab1.headers.jakarta` | `lab1.headers` | key kosong; arguments di bawah |

3. Untuk binding headers, tambahkan tiga **Arguments** pada form binding:
   `x-match` = `all`, `jenis` = `siup`, `kantor` = `jakarta`.
   Ketiganya bertipe **String**. Pilih **Bind** setelah semua terisi.
4. Saat publish H1/H2, isi bagian **Headers** pada Publish message:
   baris `jenis` = `siup`, baris `kantor` = `jakarta`, keduanya **String**.
   Baris berikutnya muncul saat Anda mengetik. Ini header pesan, berbeda
   dari Arguments pada binding. Untuk H2, ubah `kantor` menjadi `bandung`.
   Routing key boleh diisi `diabaikan`. Pertahankan Properties `delivery_mode` = `2`.
5. Buat queue tambahan `lab1.quorum`, Type **Quorum**, Durable. Jangan membuat
   binding untuk queue ini. Bandingkan label tipe/anggota queue dengan salah
   satu queue classic. Queue quorum pada broker satu node memiliki satu anggota
   dan tidak tahan kehilangan node tersebut. Latihan ini tidak menguji failover.

## D. Matriks percobaan

Setiap baris mempublikasikan **satu** pesan. Kolom tujuan merupakan hasil yang
seharusnya diperoleh; tuliskan prediksi sebelum melihatnya jika bekerja berpasangan.

| Kasus | Exchange | Routing key / header | Queue tujuan |
|---|---|---|---|
| D1 | `lab1.direct` | `pengajuan.siup.jakarta` | `lab1.direct.validasi` |
| D2 | `lab1.direct` | `pengajuan.siup.bandung` | tidak ada |
| F1 | `lab1.fanout` | `bebas` | `lab1.fanout.validasi`, `lab1.fanout.tracking` |
| T1 | `lab1.topic` | `pengajuan.siup.jakarta` | `lab1.topic.jakarta`, `lab1.topic.siup` |
| T2 | `lab1.topic` | `pengajuan.nib.jakarta` | `lab1.topic.jakarta` |
| T3 | `lab1.topic` | `pengajuan.siup.jakarta.revisi` | `lab1.topic.siup` |
| H1 | `lab1.headers` | jenis=`siup`, kantor=`jakarta` | `lab1.headers.jakarta` |
| H2 | `lab1.headers` | jenis=`siup`, kantor=`bandung` | tidak ada |

Jelaskan: mengapa T3 tidak mencapai queue Jakarta? Apa beda satu pesan yang
disalin ke dua queue dengan dua worker yang membaca satu queue? Mengapa hasil
D2 tidak boleh langsung dianggap sebagai keberhasilan penerimaan pekerjaan?

## E. Penyelesaian dan daftar tilik

- [ ] Login peserta bekerja dan hanya memiliki akses ke vhost sendiri.
- [ ] Empat exchange, enam queue classic, dan satu queue quorum terlihat.
- [ ] Delapan kasus cocok dengan matriks, termasuk dua kasus tanpa tujuan.
- [ ] Diagram mencantumkan tipe exchange, binding, queue, dan consumer yang direncanakan.
- [ ] Penjelasan membedakan routing, penyimpanan pesan, dan pemrosesan bisnis.

Kumpulkan diagram dan tabel prediksi/hasil dengan kode peserta. Jangan sertakan
password. Simpan vhost untuk sesi berikutnya. Penghapusan hanya dilakukan pada
resource milik sendiri setelah instruktur menyatakan hasil sudah disimpan.

Jika hasil berbeda: periksa vhost aktif, salah ejaan, tipe exchange, binding,
serta tipe String pada header. Error `ACCESS_REFUSED` mengarah ke akun/permission;
`PRECONDITION_FAILED` sering berarti nama resource sudah ada dengan atribut lain.
Jangan menghapus queue lain untuk memperbaikinya.

## Pemeriksaan instruktur

`tools/verify-lab1.mjs` menjalankan kasus yang sama lewat HTTP API dan menguji
penolakan akses di luar pola resource serta vhost peserta. Skrip membuat vhost
dan user sementara dengan nama unik, lalu membersihkannya sendiri. Jalankan
hanya terhadap broker lab dengan akun administrator:

```bash
RABBITMQ_MANAGEMENT_URL=http://localhost:15672 node --env-file=.env tools/verify-lab1.mjs
```

Sumber: [AMQP concepts](https://www.rabbitmq.com/tutorials/amqp-concepts),
[access control](https://www.rabbitmq.com/docs/access-control), dan
[quorum queues](https://www.rabbitmq.com/docs/quorum-queues).
