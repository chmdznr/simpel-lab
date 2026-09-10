# Lab 3 — Producer, consumer, dan bukti pemrosesan
**MP-06, hari ketiga, Rabu 16 September 2026. Praktik 4 JP (180 menit).**

Hasil akhir: gateway mengirim event yang mendapat publisher confirm; validasi menyimpan
hasil ke PostgreSQL sebelum manual ack. Peserta membuktikan perilaku ketika consumer
berhenti, menerima ulang pesan, dan memakai prefetch berbeda. Seluruh identitas sintetis.

## Batas implementasi
Lab ini merupakan tahap transport dari rancangan Lab 2. HTTP 202 dengan status
`DITERIMA_BROKER` berarti pesan telah dirutekan dan dikonfirmasi broker. Gateway belum
menulis pengajuan dan outbox dalam satu transaksi; belum ada status URL, billing, atau
notifikasi asinkron. Jika broker tidak siap, gateway tidak dapat menerima melalui outbox.
503/timeout dapat memiliki hasil publish yang belum diketahui: simpan ID respons dan
rekonsiliasi sebelum mengirim ulang. Jangan menyatakan seluruh proses bisnis selesai.

Topologi mode `work`: gateway → topic exchange `simpel.events` → binding
`pengajuan.diterima` → `validasi.q` → satu atau beberapa competing consumers.
Kontrak invalid diarahkan ke `simpel.invalid` / `pengajuan.invalid` untuk inspeksi.
Retry tertunda dan DLQ operasional dikerjakan pada Lab 4B, hari keempat.

## Prasyarat dan terminal
Jalankan dari akar repo, dengan Node 20 yang mendukung `--env-file` (20.6+),
Docker, dependensi terpasang, dan konfigurasi lokal yang sudah dipakai pada Lab 0.
Jangan menimpa `.env` yang sudah ada. Jika belum ada, salin `.env.contoh`.
Pada broker bersama, gunakan vhost pribadi dan database/skema yang disediakan panitia.

```bash
docker compose up -d rabbitmq postgres
npm install
npm run db:siapkan
```

Perintah terakhir menambahkan tabel yang belum ada tanpa menghapus baris. Init SQL
Docker hanya berjalan pada volume baru; karena itu volume lama juga perlu perintah ini.
Terminal A untuk gateway, B–D untuk worker, E untuk pengirim dan pemeriksaan.
Pastikan layanan demo sinkron pada port 3001 sudah dihentikan oleh pemiliknya.

## 3a — Producer (45 menit)
Alokasi: 5 menit tujuan, 8 membaca kontrak, 8 menelusuri publish, 8 menjalankan,
10 menguji batas respons, 6 diskusi bukti.

1. Baca `layanan/gateway/index.js` dan `layanan/messaging.js`.
   Bedakan business ID `data.pengajuanId`, identitas event `messageId`,
   dan jejak proses `correlationId`. Satu retry atas event yang sama harus
   mempertahankan message ID; kiriman HTTP baru pada starter menghasilkan ID baru.
2. Jalankan A: `SIMPEL_MODE=work npm run broker:gateway`. Buka
   `http://127.0.0.1:3001/health`; seharusnya `ready: true`.
   Jangan jalankan consumer dahulu.
3. E: `npm run kirim -- --count=1 --run=awal`. Bukti respons ditulis ke
   `.evidence/awal.json`; baca nilai confirmed dan ID. Kirim hanya sekali
   dengan run ID ini agar penghitungan tidak tercampur.
4. Di RabbitMQ Management, buka vhost sendiri, queue `validasi.q`.
   Amati Ready bertambah; gunakan refresh. Jangan menekan Get messages dengan
   automatic acknowledgment karena itu mengambil dan menyelesaikan pesan.
5. E: `npm run hasil -- awal` menghasilkan validationRows 0. Jelaskan mengapa
   confirmed 1 dan baris DB 0 konsisten. Bandingkan dengan rancangan outbox Lab 2.
6. Telusuri callback confirm, event `return`, dan boolean `publish()`.
   `mandatory` mendeteksi tidak ada rute; confirm sendiri juga dapat diterima
   untuk pesan unroutable. Boolean hanya memberi sinyal buffer lokal.

**Bukti:** file receipt, queue Ready, hasil database, dan satu kalimat arti HTTP 202.
Jangan mengubah kode agar mengembalikan sukses sebelum callback confirm.

## 3b — Consumer dan manual acknowledgment (45 menit)
Alokasi: 5 menit prediksi, 8 membaca worker, 8 menjalankan, 8 menelusuri ack,
10 kasus kegagalan, 6 pembahasan.

1. Baca `layanan/worker.js`; temukan `noAck: false`, `prefetch`,
   INSERT, dan `channel.ack(message)`. Kode sudah lengkap; komentar latihan
   meminta penjelasan, bukan menandai baris yang wajib ditambal.
2. B: `SIMPEL_MODE=work npm run broker:validasi`. Tunggu log ready.
   E: `npm run hasil -- awal`; validationRows menjadi 1.
3. Kirim `npm run kirim -- --count=5 --run=normal`. Cocokkan kelima business ID
   pada receipts dengan log committed, bukan hanya jumlah total database.
4. Bahas tiga jendela crash: sebelum INSERT, setelah commit sebelum ack,
   dan setelah ack. Pesan yang belum di-ack dikembalikan setelah channel/connection
   tertutup; koneksi putus tidak harus terdeteksi seketika.
5. Uji terarah opsional dengan satu pesan: hentikan worker menggunakan Ctrl-C;
   jalankan `VALIDASI_ACK_DELAY_MS=10000 npm run broker:validasi`.
   Kirim satu event dengan run ID baru. Setelah log committed, hentikan **hanya PID
   worker latihan tersebut** dengan terminasi paksa melalui task manager atau
   terminal yang telah mengidentifikasi PID. Jangan hentikan broker/database.
   Jalankan worker normal; cari `redelivered: true` dan `duplicate: true`.
   Gunakan `npm run verify:day3` jika tidak ingin melakukan terminasi manual.
6. Diskusikan batas `ON CONFLICT (id) DO NOTHING`: cukup untuk satu INSERT ini,
   belum merupakan transaksi deduplikasi seluruh workflow atau efek eksternal.

Jika data invalid, consumer menolak tanpa requeue dan menyimpan melalui DLX yang
telah dibuat. Jika operasi DB gagal, consumer membatalkan konsumsi lalu berhenti,
sehingga tidak membuat loop requeue cepat. Pulihkan dependensi lalu jalankan ulang.
Restart/reconnect otomatis sengaja belum ditambahkan pada starter kelas.

## 3c — Consumer berhenti, 100 pesan tetap dapat diselesaikan (45 menit)
Alokasi: 5 menit hipotesis, 8 menyiapkan baseline, 8 mengirim saat berhenti,
8 mengamati queue, 10 memulihkan dan mencocokkan ID, 6 menulis kesimpulan.

1. Hentikan semua worker validasi milik latihan dengan Ctrl-C. Gateway tetap hidup.
   Pastikan consumers pada `validasi.q` bernilai 0. Queue awal sebaiknya kosong;
   selesaikan pesan lama dengan consumer, jangan purge sembarangan.
2. Catat run ID baru, misalnya `mati01`. E:
   `npm run kirim -- --count=100 --run=mati01`.
3. Simpan receipt confirmed 100. Queue Ready bertambah 100 dan
   `npm run hasil -- mati01` menunjukkan 0 baris untuk run ini.
4. B: `npm run broker:validasi`. Tunggu sampai queue tidak menyisakan pekerjaan
   run ini. E: `npm run hasil -- mati01` harus menunjukkan 100.
5. Hitung ID unik dan cocokkan identitas. Pemeriksaan otomatis lengkap tersedia di
   `tools/verify-day3.js`. Screenshot jumlah saja belum membuktikan tidak ada ID
   hilang atau satu ID tergantikan duplikat.
6. Kesimpulan yang sah: pada skenario consumer berhenti ini, semua 100 ID yang
   mendapat respons konfirmasi ditemukan setelah pemulihan. Eksperimen ini tidak
   membuktikan toleransi kerusakan disk/node, seluruh jenis crash, atau exactly-once.

## 3d — Tiga consumer, prefetch 1 dan 100 (45 menit)
Alokasi: 5 menit menentukan variabel, 8 menjalankan konfigurasi pertama,
8 mencatat hasil, 8 konfigurasi kedua, 10 membandingkan, 6 menyimpulkan.

Gunakan beban I/O yang sama: `VALIDASI_KERJA_MS=120`, pool maksimum 4 per worker.
Pada starter broker, beban ini berupa `pg_sleep` yang menahan koneksi. Kode sinkron
lama membakar CPU; hasil dua jenis beban ini tidak boleh dibandingkan seolah setara.

Jalankan B, C, D dengan ID berbeda:
```bash
WORKER_ID=w1 VALIDASI_PREFETCH=1 VALIDASI_POOL_MAX=4 npm run broker:validasi
WORKER_ID=w2 VALIDASI_PREFETCH=1 VALIDASI_POOL_MAX=4 npm run broker:validasi
WORKER_ID=w3 VALIDASI_PREFETCH=1 VALIDASI_POOL_MAX=4 npm run broker:validasi
```

E: `npm run kirim -- --count=120 --run=p1`. Tunggu 120 baris, catat elapsed time,
Ready/Unacked, jumlah received per worker, maxInFlight, maxPoolWaiting, dan cpuMs.
Hentikan ketiga worker; log metrics dengan `final: true` memuat ringkasan.
Ulangi ketiga perintah dengan prefetch 100 dan run ID `p100`. Jangan mencampur
worker prefetch 1 dengan 100. Ulangi percobaan jika ada gangguan atau hasil janggal.

| Ukuran | Prefetch 1 | Prefetch 100 |
|---|---|---|
| Run ID dan jumlah ID selesai | isi hasil | isi hasil |
| Waktu sampai seluruh ID tersimpan | isi hasil | isi hasil |
| Puncak Unacked / in-flight | isi hasil | isi hasil |
| Koneksi DB aktif dan pool waiting | isi hasil | isi hasil |
| CPU proses worker, cakupan waktu sama | isi hasil | isi hasil |
| Pembagian pekerjaan / batas kesimpulan | isi hasil | isi hasil |

Prefetch membatasi delivery yang belum di-ack, bukan jumlah koneksi DB.
Dengan tiga worker dan pool max 4, batas pool gabungan 12; prefetch 1 membatasi
masing-masing worker pada satu delivery. Nilai 100 memungkinkan pekerjaan menunggu
di aplikasi. Pilih nilai berdasarkan kemampuan downstream dan sasaran latency,
bukan klaim bahwa 1 pasti tercepat atau 100 pasti membanjiri DB dengan 300 query.

## Pemeriksaan otomatis untuk instruktur
`npm run verify:day3` membuat stack **terpisah** bernama `simpel-day3-qa`
pada loopback port 5763, 15683, 5463, dan gateway 3063. Tidak membaca `.env`.
Jika project QA sudah ada, skrip berhenti agar keadaan sebelumnya bisa diperiksa.
Setelah selesai, skrip menghapus hanya stack/volume QA miliknya. Hasil ada di
`.evidence/day3-verification.json` (diabaikan Git).

Check mencakup input invalid, 100 receipt/ID saat consumer mati, unroutable publish,
kontrak invalid, crash setelah commit, explicit duplicate, kedua konfigurasi prefetch,
kegagalan statement DB, dan fanout dengan tracking berhenti. Ini uji fungsional lokal,
bukan sertifikasi kapasitas produksi atau pengujian kehilangan node broker.

## Troubleshooting dan penilaian
- `ECONNREFUSED` / startup failed: periksa status broker/DB, port dan vhost,
  lalu ulangi setelah dependensi siap. Jangan mencetak URL yang memuat password.
- `PRECONDITION_FAILED`: tipe/argumen resource yang namanya sama tidak cocok.
  Pakai vhost latihan yang tepat; jangan menghapus queue berisi data untuk memaksa cocok.
- Ready tidak berkurang: cek consumer count, nama queue dan mode. Unacked menetap:
  periksa DB, ack, dan worker logs sebelum menambah consumer.
- Tabel tracking tidak ditemukan: jalankan `npm run db:siapkan`, bukan menghapus volume.
- 503/timeout saat publish: simpan ID yang tersedia, periksa queue dan log,
  tentukan apakah hasil belum diketahui. Pengiriman ulang HTTP membuat business ID baru.

Penilaian 10 poin: arti confirm/ack benar (2), bukti 100 ID lengkap (3),
crash/duplikasi dijelaskan (2), perbandingan prefetch dengan batas yang jujur (3).
Kumpulkan laporan ringkas dan receipts tanpa kredensial. Pengayaan: baca
[amqplib API](https://amqp-node.github.io/amqplib/channel_api.html),
[RabbitMQ confirms](https://www.rabbitmq.com/docs/confirms), dan
[consumer prefetch](https://www.rabbitmq.com/docs/consumer-prefetch).
