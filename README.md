# SIMPEL Lab

Lab praktik untuk PJJ *Implementasi dan Pengelolaan Message Broker untuk
Arsitektur Microservices* (Pusdiklat KU, 14–25 September 2026).

Semua praktik memakai satu skenario fiktif yang sama: **SIMPEL — Sistem
Perizinan Elektronik**. Nama layanannya tetap dalam bentuk ini di seluruh
materi (modul, slide, narasi, lab):

```
Pengguna → gateway → validasi → billing → notifikasi
                          ↓
                     tracking
```

| Layanan | Peran | Sifat yang sengaja dipilih |
|---|---|---|
| `gateway` | Terima pengajuan (HTTP) | Titik ukur response time |
| `validasi` | Validasi dokumen | CPU-bound, hantam DB → sumber LI-2 |
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
| 2 | Lab 1 — bedah topologi | `lab/lab1-topologi/` |
| 3–4 | Lab 2–4 — producer/consumer, routing | *(disiapkan menyusul)* |
| 4–5 | Lab 5–7 — end-to-end, monitoring, troubleshooting | *(disiapkan menyusul)* |

## Kenapa dua versi (`sinkron/` vs `layanan/`)?

Prinsip pedagogis materi ini adalah **failure-first**: setiap konsep broker
diajarkan dengan dulu merasakan sakitnya versi tanpa broker. `sinkron/`
dirusak di depan kelas di MP-2 supaya masalahnya (LI-1, LI-3) terasa nyata
sebelum solusinya (`layanan/`, dibangun bertahap mulai MP-6) dijelaskan.
