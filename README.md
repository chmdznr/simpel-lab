# SIMPEL Lab

Lab praktik untuk PJJ *Implementasi dan Pengelolaan Message Broker untuk
Arsitektur Microservices* (Pusdiklat KU, 14–25 September 2026).

Semua praktik memakai satu skenario fiktif yang sama: **SIMPEL — Sistem
Perizinan Elektronik**. Nama layanannya tetap dalam bentuk ini di seluruh
materi (modul, slide, narasi, lab):

Urutan bisnisnya adalah pengajuan → validasi → billing → notifikasi; tracking
mencatat status. Pada demo `sinkron/`, gateway memanggil layanan satu per satu.
Pada rancangan asinkron Lab 2, exchange merutekan event ke queue masing-masing
consumer. Lab 5 sekarang menjalankan lima peran melalui `layanan/alur.js`,
dengan acceptance DB+outbox, inbox per subscriber, status pengajuan, dan kompensasi.
Nama queue `alur.*` terpisah dari latihan hari ketiga.

| Layanan | Peran | Sifat yang sengaja dipilih |
|---|---|---|
| `gateway` | Terima pengajuan (HTTP) | Titik ukur response time |
| `validasi` | Validasi dokumen | Demo sinkron: kerja CPU; Lab 3: I/O DB dengan pool terbatas |
| `billing` | Terbitkan kode billing | Bergantung sistem eksternal, kadang mati → sumber LI-1 |
| `notifikasi` | Kirim notifikasi | Lambat (pihak ketiga, \~3 dtk) → sumber LI-3 |
| `tracking` | Audit & status | Konsumen kedua atas event yang sama → contoh pub-sub |

> `SIMPEL` sepenuhnya fiktif, disederhanakan untuk pelatihan — bukan
> representasi sistem INSW yang sebenarnya.

## Isi repo

```
simpel-lab/
  docker-compose.yml   RabbitMQ 4.x, Postgres, Prometheus, Grafana
  .env.contoh           salin ke .env sebelum mulai
  sinkron/               versi TANPA broker, sengaja rapuh — demo MP-2
  layanan/               versi DENGAN broker — dibangun bertahap MP-6..MP-8
  lab/                    panduan tiap lab praktik, langkah demi langkah
  tools/beban.js          pembangkit beban, ukur p50/p95 & tingkat kegagalan
  db/                     skema Postgres, dijalankan otomatis oleh compose
  infra/                  konfigurasi Prometheus & Grafana
```

## Mulai cepat

Ikuti **`PANDUAN-SETUP.md`** — dikirim H-1, berisi langkah lengkap
`docker compose up`, cara memverifikasi berhasil, troubleshooting, dan cara
memakai broker cadangan kalau Docker Desktop diblokir kebijakan IT kantor.

Ringkas untuk yang sudah familiar:

```bash
cp .env.contoh .env
docker compose up -d rabbitmq postgres
npm install
```

Lalu ikuti panduan lab sesuai jadwal hari itu:

| Hari | Lab | Folder |
|---|---|---|
| 1 | Lab 0 — broker hidup | `lab/lab0-broker-hidup/` |
| 1 | Demo sinkron (MP-2) | `sinkron/README.md` |
| 2 | Lab 1 — bedah topologi (MP-04, 90 menit) | [Panduan Lab 1](lab/lab1-topologi/README.md) |
| 2 | Lab 2 — desain integrasi (MP-05, 45 menit) | [Panduan dan lembar kerja](lab/lab2-desain/README.md) |
| 2 | Demo instruktur Kafka (MP-04) | [Demo replay](demo/kafka/README.md) |
| 3 | Lab 3 — producer/consumer, 180 menit | [Panduan dan uji](lab/lab3-producer-consumer/README.md) |
| 3 | Lab 4A — fanout, 45 menit | [Panduan Lab 4A](lab/lab4-routing/README.md) |
| 4 | Lab 4B — routing lanjutan, retry/DLQ, 90 menit | [Panduan Lab 4B](lab/lab4-routing/README-part2.md) |
| 4 | Lab 5 — end-to-end dan pengukuran, 135 menit | [Panduan Lab 5](lab/lab5-integrasi/README.md) |
| 5 | Lab 6–7 — monitoring dan troubleshooting | *(disiapkan menyusul)* |

Hari keempat menyediakan `tools/beban-alur.js` untuk pembanding terkontrol
dengan fungsi efek bisnis yang sama pada mode sync dan async. Ukur HTTP response,
observed completion, dan tekanan DB secara terpisah. Ini berbeda dari demo
CPU-bound hari pertama. Notifikasi hari keempat adalah receipt DB sintetis.
`npm run verify:day4` menjalankan pemeriksaan terisolasi, termasuk dua burst 500;
`npm run verify:day3` memeriksa regresi latihan sebelumnya. Jangan menjalankan
keduanya bersamaan karena memakai port QA yang sama.

## Kenapa dua versi (`sinkron/` vs `layanan/`)?

Prinsip pedagogis materi ini adalah **failure-first**: setiap konsep broker
diajarkan dengan dulu merasakan sakitnya versi tanpa broker. `sinkron/`
dirusak di depan kelas di MP-2 supaya masalahnya (LI-1, LI-3) terasa nyata
sebelum solusinya (`layanan/`, dibangun bertahap mulai MP-6) dijelaskan.
