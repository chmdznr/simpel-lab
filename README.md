# SIMPEL Lab

Repositori lab praktik untuk Pelatihan Jarak Jauh (PJJ) *Implementasi dan Pengelolaan Message Broker untuk Arsitektur Microservices* (Pusdiklat Keuangan Umum, BPPK Kemenkeu, 14–25 September 2026).

Seluruh sesi praktik menggunakan satu skenario domain konkret yang sama: **SIMPEL — Sistem Perizinan Elektronik**.

Alur bisnis inti SIMPEL: `Pengajuan` → `Validasi` → `Billing` → `Notifikasi`, dengan `Tracking` yang mencatat audit log dan riwayat status:
- Pada **versi synchronous** (`sinkron/`), Gateway memanggil setiap service hilir secara berantai melalui panggilan HTTP REST biasa.
- Pada **versi asynchronous berbroker** (Lab 2 hingga Lab 5), Gateway mengamankan pengajuan via Transactional Outbox, kemudian RabbitMQ merutekan event ke queue masing-masing service consumer secara decoupled.
- Pada **Lab 5**, alur end-to-end dijalankan penuh via `layanan/alur.js`, lengkap dengan inbox deduplikasi, polling status pengajuan, dan mekanisme kompensasi kegagalan.

| Layanan | Peran Bisnis | Karakteristik yang Disimulasikan |
|---|---|---|
| `gateway` | Menerima request pengajuan izin (HTTP) | Titik ukur ingress response time |
| `validasi` | Validasi kelayakan dokumen pemohon | Beban komputasi CPU & operasi I/O database |
| `billing` | Menerbitkan kode pembayaran ke bank | Bergantung pada API pihak ketiga, simulasi downtime |
| `notifikasi` | Mengirim konfirmasi email/SMS ke pemohon | Latensi lambat (vendor eksternal ~3 detik) |
| `tracking` | Pencatatan audit trail & riwayat status | Consumer independen yang menerima event yang sama (Pub-Sub) |

> **Catatan:** Sistem `SIMPEL` sepenuhnya fiktif dan disederhanakan untuk kebutuhan pembelajaran teknis, bukan representasi dari sistem produksi INSW yang sebenarnya.

---

## Struktur Repositori

```text
simpel-lab/
  docker-compose.yml   Definisi container: RabbitMQ 4.x, PostgreSQL 16, Prometheus, Grafana
  .env.contoh          Template konfigurasi environment (salin ke .env sebelum mulai)
  sinkron/             Versi synchronous TANPA broker (sengaja dibuat rapuh untuk demo MP-02)
  layanan/             Versi microservices DENGAN broker (dibangun bertahap di MP-06 s.d. MP-08)
  lab/                 Panduan langkah demi langkah untuk setiap modul hands-on
  tools/beban.js       Script generator beban untuk mengukur throughput, latensi p50/p95, dan error rate
  db/                  Skema DDL PostgreSQL (dieksekusi otomatis saat container postgres inisialisasi)
  infra/               Konfigurasi monitoring: Prometheus scrape rules & Grafana dashboards
```

---

## Panduan Mulai Cepat

Bagi peserta baru, silakan baca **[`PANDUAN-SETUP.md`](PANDUAN-SETUP.md)** yang dikirim H-1 sebelum pelatihan. Panduan tersebut memuat langkah instalasi lengkap, instruksi `docker compose up`, cara verifikasi kesehatan container, dan panduan troubleshooting.

Ringkasan cepat bagi yang sudah terbiasa dengan Docker dan Node.js:

```bash
cp .env.contoh .env
docker compose up -d rabbitmq postgres
npm install
```

Setelah environment siap, ikuti modul lab sesuai jadwal harian:

| Hari | Lab / Sesi | Folder / Dokumen Panduan |
|---|---|---|
| 1 | Lab 0 — Verifikasi Broker Hidup | [`lab/lab0-broker-hidup/`](lab/lab0-broker-hidup/README.md) |
| 1 | Demo Arsitektur Synchronous (MP-02) | [`sinkron/README.md`](sinkron/README.md) |
| 2 | Lab 1 — Bedah Topologi RabbitMQ (MP-04, 90 menit) | [Panduan Lab 1](lab/lab1-topologi/README.md) |
| 2 | Lab 2 — Desain Integrasi SIMPEL (MP-05, 45 menit) | [Panduan & Lembar Kerja Lab 2](lab/lab2-desain/README.md) |
| 2 | Demo Instruktur Apache Kafka (MP-04) | [Panduan Demo Kafka](demo/kafka/README.md) |
| 3 | Lab 3 — Producer, Consumer, & Manual Ack (MP-06, 180 menit) | [Panduan Lab 3](lab/lab3-producer-consumer/README.md) |
| 3 | Lab 4A — Fanout & Independent Subscription (MP-07, 45 menit) | [Panduan Lab 4A](lab/lab4-routing/README.md) |
| 4 | Lab 4B — Topic Routing, Backoff Retry, & DLQ (MP-07, 90 menit) | [Panduan Lab 4B](lab/lab4-routing/README-part2.md) |
| 4 | Lab 5 — Integrasi End-to-End & Benchmark Beban (MP-08, 135 menit) | [Panduan Lab 5](lab/lab5-integrasi/README.md) |
| 5 | Lab 6 — Monitoring Metrik, Alerting, & Security Probe (MP-09, 90 menit) | [Panduan Lab 6](lab/lab6-monitoring/README.md) |
| 5 | Lab 7 — Troubleshooting Insiden Terdistribusi (MP-10, 45 menit/kelompok) | [Panduan Lab 7](lab/lab7-troubleshooting/README.md) |
| 5 / Minggu 2 | Pengarahan & Pengerjaan Proyek Action Learning | [Template & Panduan Capstone](lab/action-learning/TEMPLATE.md) |

---

## Catatan Khusus Praktik Lanjutan

- **Hari 4 (Benchmark Alur Terkontrol)**:
  Tersedia `tools/beban-alur.js` untuk menguji perbandingan performa antara mode synchronous dan asynchronous dengan beban bisnis yang identik. Di sini kita membedakan pengukuran *HTTP response time* (waktu ke balasan HTTP 202) versus *observed completion time* (waktu hingga seluruh proses bisnis selesai) serta memantau utilisasi koneksi database. Pengujian verifikasi terisolasi dapat dijalankan via `npm run verify:day4`.

- **Hari 5 (Stack Monitoring & Troubleshooting Terisolasi)**:
  Praktik monitoring dan troubleshooting dijalankan pada compose stack terpisah menggunakan perintah `npm run operasi -- up`. Stack ini menggunakan port dan volume mandiri (project `simpel-ops`) sehingga tidak mengganggu data lab hari-hari sebelumnya. Verifikasi komprehensif hari ke-5 dapat dijalankan via `npm run verify:day5`.

---

## Mengapa Dua Versi (`sinkron/` vs `layanan/`)?

Pendekatan pembelajaran pelatihan ini menggunakan prinsip **failure-first**: peserta diajak memahami urgensi message broker dengan cara mengalami langsung kerapuhan arsitektur tanpa broker. 

Arsitektur monolitik/berantai di folder `sinkron/` sengaja dirusak saat demo MP-02 agar dampak downtime parsial dan latensi kaskade terasa nyata, sebelum solusi berbasis message broker (`layanan/`) dibangun dan diuji secara bertahap mulai MP-06.
