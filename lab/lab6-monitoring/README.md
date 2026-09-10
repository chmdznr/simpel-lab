# Lab 6 — Monitoring dan izin publisher

MP-09, hari kelima. Praktik 90 menit: 45 menit monitoring, 45 menit pembatasan akses. Semua data dan kredensial di sini khusus latihan lokal.

## 1. Mulai dari root repository

Prasyarat: Docker Compose, Node.js >=20.6, serta dependency yang sudah dipasang dengan `npm ci`. Perintah hari kelima tidak membaca `.env` lab sebelumnya.

```sh
npm run operasi -- up
npm run operasi -- setup
npm run operasi -- snapshot
```

Stack memakai project `simpel-ops` dengan volume sendiri. Tidak memakai atau memigrasikan volume Grafana lama dari compose root.

| Komponen | Alamat lokal | Akun kelas |
|---|---|---|
| RabbitMQ Management | http://127.0.0.1:15695 | `labops` / `labops-only` |
| Grafana | http://127.0.0.1:3005/d/simpel-ops | `labops` / `labops-only` |
| Prometheus | http://127.0.0.1:9095 | Tanpa login, loopback |
| AMQP | 127.0.0.1:5775 | `labops` / `labops-only`, vhost `lab6` |
| PostgreSQL | 127.0.0.1:5475 | `labops` / `labops-only`, database `labops` |

Image yang dipin untuk latihan: RabbitMQ 4.3.5, Prometheus 3.14.0, Grafana 13.2.1; PostgreSQL menggunakan tag mayor 16-alpine. Ini konfigurasi lokal plain text, bukan contoh deployment TLS.

Jika port terpakai, identifikasi proses pemiliknya. Jangan menghentikan container atau menghapus volume lain. `up` dapat memerlukan waktu saat mengunduh image pertama kali.

## 2. Buat dan amati backlog

Pastikan consumer monitoring belum berjalan.

```sh
npm run operasi -- publish 100
npm run operasi -- snapshot
```

Catat vhost, queue, waktu sampel, ready, unacked, consumer, serta alarm node. Setelah statistik diperbarui, pekerjaan menunggu di `lab6.q`. Buka Grafana, pilih **Vhost: lab6**, rentang 15 menit, dan perhatikan enam panel.

Pada Prometheus, buka halaman **Alerts** dan cari `SimpelQueueWithoutConsumer`. Rule: ready > 0 dan consumers = 0, dipertahankan 15 detik. Waktu scrape/evaluasi menambah jeda sebelum firing. Ini contoh rule keadaan queue, belum termasuk pengiriman notifikasi Alertmanager.

Di terminal kedua:

```sh
npm run operasi -- consumer
```

Consumer memakai manual ack, prefetch 2, dan delay simulasi 200 ms. Amati ready turun, unacked, delivery/ack rate, lalu alert berhenti firing. Consumer ini hanya simulasi transport; acknowledgement-nya bukan bukti transaksi bisnis.

Jangan mengganti missing series dengan nol. Panel rate perlu cukup sampel. Gunakan scrape health untuk membedakan masalah collection dari keadaan queue.

## 3. Baca konfigurasi metrik

- `prometheus.yml`: `/metrics/per-object` untuk gauge queue, `/metrics/detailed?family=queue_delivery_metrics` untuk counter per queue.
- `alerts.yml`: queue tanpa consumer dan scrape target broker tidak tersedia.
- `grafana/`: datasource dan dashboard yang diprovisikan otomatis.
- Variable vhost mencegah hasil lab6 bercampur dengan kasus lab7.

Query contoh setelah cukup sampel:

```promql
rabbitmq_queue_messages_ready{vhost="lab6"}
rate(rabbitmq_detailed_queue_messages_acked_total{vhost="lab6"}[1m])
up{job="rabbitmq"}
```

Scrape lima detik dan per-object metrics dipilih untuk lingkungan kecil. Filter family/vhost, cardinality, interval, dan retention perlu ditinjau lagi pada lingkungan besar. Nilai `up=1` membuktikan scrape, bukan AMQP atau hasil bisnis.

## 4. Buktikan izin minimum

```sh
npm run operasi -- permissions
npm run operasi -- probe
```

User `lab6-publisher`, password kelas `publisher-lab-only`, tanpa management tag. Hak vhost `lab6`: configure `^$`, write `^lab6\.events$`, read `^$`. Bootstrap menyiapkan topology; runtime publisher tidak melakukan declare.

Hasil wajib:

| Operasi | Hasil |
|---|---|
| Publish ke `lab6.events` | Allowed dan confirmed |
| Publish ke exchange lain | Ditolak broker |
| Declare queue | Ditolak broker |
| Membaca `lab6.q` | Ditolak broker |

Probe memeriksa `403/ACCESS_REFUSED`, bukan sekadar error/timeout. Channel yang ditolak dapat ditutup broker sehingga tes berikutnya memakai koneksi baru. User ini tetap tidak boleh membaca atau mendeklarasikan queue hanya karena sebuah publikasi berhasil.

Snapshot menampilkan user, vhost, state, dan channel untuk koneksi aktif. Probe berumur pendek bisa sudah tidak terlihat ketika snapshot berikutnya diambil. Daftar koneksi bukan audit historis seluruh operasi.

## 5. Bukti yang dikumpulkan

Tuliskan satu tabel before/after queue, status firing/recovery alert, empat hasil probe, dan satu batas pembuktian. Contoh batas: belum menguji TLS, notifikasi eksternal, atau hasil bisnis.

Diskusikan keadaan alternatif: consumer ada, dua unacked bertahan, ack rate nol. Rule tanpa consumer tidak akan menangkapnya. Cari bukti proses/dependency; praktiknya ada pada Lab 7.

## 6. Berhenti

Hentikan foreground consumer dengan Ctrl+C. Jika langsung lanjut MP-10, stack boleh tetap berjalan.

```sh
npm run operasi -- down
```

Shutdown normal mempertahankan volume. Tidak ada perintah purge/reset dalam alur peserta.

Pemeriksaan pengajar: `npm run verify:day5` membuat project **simpel-day5-qa**, menolak resource QA yang sudah ada, dan membersihkan hanya stack QA yang dibuatnya. Hentikan `simpel-ops` lebih dahulu karena port lokal sama. Verifier menguji metrik, alert, izin, empat kasus, dan alarm memori sementara dengan pemulihan threshold; jangan menyalin injeksi alarm ke broker lain.

Referensi: [RabbitMQ metrics](https://www.rabbitmq.com/docs/prometheus), [access control](https://www.rabbitmq.com/docs/access-control), [alarms](https://www.rabbitmq.com/docs/alarms), [TLS](https://www.rabbitmq.com/docs/ssl).
